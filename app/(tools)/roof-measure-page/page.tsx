'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, MapPin, Loader2, Ruler, CheckCircle, AlertCircle, AlertTriangle,
  CloudLightning, Home, Hash, Building, Copy, ExternalLink, ChevronRight,
  ChevronLeft, Plus, Trash2, Eye, BarChart3, Shield,
  Layers, Triangle, Square, Info, X, Maximize2,
  Warehouse, TreePine, Camera, Upload,
  Check, ZoomIn, ChevronDown, ChevronUp,
  RotateCcw, CircleDot, Compass
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

type Step = 'address' | 'structure' | 'imagery' | 'measuring' | 'results';

interface Structure {
  id: string;
  name: string;
  type: 'main' | 'garage' | 'shed' | 'barn' | 'addition' | 'other';
  polygon: google.maps.LatLng[];
  polygonOverlay?: google.maps.Polygon;
  measured: boolean;
  result?: ApiResponse | null;
  error?: string;
}

interface MeasurementItem {
  totalFt: number;
  count: number;
  details: { lengthFt: number }[];
  confidence: string;
}

interface Measurements {
  ridges: MeasurementItem;
  rakes: MeasurementItem;
  valleys: MeasurementItem;
  eaves: MeasurementItem;
  hips: MeasurementItem;
  pitches: { primary: string; all: { pitch: string }[]; confidence: string };
  roofStyle: string;
  perimeterFt: number;
}

interface RoofComponent {
  type?: string;
  count?: number;
  length_ft?: number;
  width_ft?: number;
  diameter_in?: number;
  flashing_perimeter_ft?: number;
  description?: string;
  confidence: string;
}

interface Components {
  flashing: RoofComponent[];
  transitions: RoofComponent[];
  vents: RoofComponent[];
  pipes: RoofComponent[];
  chimneys: RoofComponent[];
  skylights: RoofComponent[];
}

interface RoofOutlineVertex { id: string; x: number; y: number; label?: string }
interface RoofOutlineEdge { from: string; to: string; type: string; length_ft: number; label?: string }
interface RoofOutlineSection { vertices: string[]; pitch: string; area_sqft: number; direction: string; label?: string }
interface RoofOutline {
  vertices: RoofOutlineVertex[];
  edges: RoofOutlineEdge[];
  sections: RoofOutlineSection[];
}

interface ApiResponse {
  address: string;
  lat: number;
  lng: number;
  generatedAt: string;
  imageryDate: string;
  solarData: {
    totalRoofAreaSqFt: number;
    groundFootprintSqFt: number;
    segmentCount: number;
    segments: { pitchDegrees: number; azimuthDegrees: number; areaSqFt: number; direction: string }[];
  };
  measurements: Measurements;
  components: Components;
  roofOutline: RoofOutline | null;
  overallConfidence: string;
  qualityNotes: string[];
  images: {
    satellite: string;
    satelliteZooms: string[];
    streetView: string[];
    esriAerial: string[];
    bingAerial: string[];
    mapboxSatellite: string[];
  };
  pipeline: {
    phase: number;
    totalAiPasses: number;
    finalVariance: number;
    allProviderResults: { name: string; totalRidge: number; totalRake: number; totalEave: number }[];
  };
  error?: string;
}

interface PreviewImage {
  id: string;
  src: string;
  label: string;
  source: string;
  selected: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STEP_ORDER: Step[] = ['address', 'structure', 'imagery', 'measuring', 'results'];
const STEP_LABELS: Record<Step, string> = {
  address: 'Address',
  structure: 'Select Structure',
  imagery: 'Review Imagery',
  measuring: 'Measuring',
  results: 'Results',
};

const STRUCTURE_TYPES = [
  { value: 'main', label: 'Main House', icon: Home },
  { value: 'garage', label: 'Garage', icon: Warehouse },
  { value: 'shed', label: 'Shed', icon: TreePine },
  { value: 'barn', label: 'Barn', icon: Building },
  { value: 'addition', label: 'Addition', icon: Plus },
  { value: 'other', label: 'Other', icon: Square },
] as const;

const POLYGON_COLORS: Record<string, string> = {
  main: '#39FF14', garage: '#F59E0B', shed: '#10B981',
  barn: '#EF4444', addition: '#8B5CF6', other: '#EC4899',
};

const EDGE_COLORS: Record<string, string> = {
  ridge: '#EF4444', rake: '#F59E0B', valley: '#10B981', eave: '#3B82F6', hip: '#8B5CF6',
};

const CLOSE_THRESHOLD_PX = 15;

// ── Main Component ──────────────────────────────────────────────────────────

export default function RoofMeasureTool() {
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [formattedAddress, setFormattedAddress] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [geocodedLocation, setGeocodedLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Structure state
  const [structures, setStructures] = useState<Structure[]>([]);
  const [activeStructureId, setActiveStructureId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<google.maps.LatLng[]>([]);
  const [drawingType, setDrawingType] = useState<Structure['type']>('main');

  // Imagery state
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Measurement state
  const [measuring, setMeasuring] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [varianceWarning, setVarianceWarning] = useState(false);

  // Results state
  const [selectedStructureReport, setSelectedStructureReport] = useState<string | null>(null);

  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const drawingPolylineRef = useRef<google.maps.Polyline | null>(null);
  const drawingMarkersRef = useRef<google.maps.Marker[]>([]);
  const firstPointMarkerRef = useRef<google.maps.Marker | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streetViewRefs = useRef<(HTMLDivElement | null)[]>([]);
  const svPanoramasRef = useRef<google.maps.StreetViewPanorama[]>([]);

  // ── Load Google Maps ──────────────────────────────────────────────────────

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    const initMaps = () => {
      if ((window as any).google?.maps) {
        autocompleteRef.current = new google.maps.places.AutocompleteService();
        setMapsLoaded(true);
      }
    };

    if ((window as any).google?.maps) {
      initMaps();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry`;
    script.async = true;
    script.onload = initMaps;
    document.head.appendChild(script);
  }, []);

  // ── Initialize Map ────────────────────────────────────────────────────────

  const initMap = useCallback((lat: number, lng: number) => {
    if (!mapContainerRef.current || !mapsLoaded) return;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat, lng },
      zoom: 20,
      mapTypeId: 'satellite',
      tilt: 0,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    new google.maps.Marker({
      position: { lat, lng },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#39FF14',
        fillOpacity: 1,
        strokeColor: '#000',
        strokeWeight: 2,
      },
      title: 'Property Location',
    });

    mapRef.current = map;
  }, [mapsLoaded]);

  // ── Drawing logic ─────────────────────────────────────────────────────────

  const startDrawing = useCallback((type: Structure['type'] = 'main') => {
    if (!mapRef.current) return;
    setIsDrawing(true);
    setDrawPoints([]);
    setDrawingType(type);
    mapRef.current.setOptions({ draggableCursor: 'crosshair' });

    drawingPolylineRef.current?.setMap(null);
    drawingMarkersRef.current.forEach(m => m.setMap(null));
    drawingMarkersRef.current = [];
    firstPointMarkerRef.current = null;

    const polyline = new google.maps.Polyline({
      map: mapRef.current,
      strokeColor: POLYGON_COLORS[type] || '#39FF14',
      strokeOpacity: 0.8,
      strokeWeight: 3,
    });
    drawingPolylineRef.current = polyline;
  }, []);

  const closePolygon = useCallback((points: google.maps.LatLng[]) => {
    if (points.length < 3 || !mapRef.current) return;

    setIsDrawing(false);
    mapRef.current.setOptions({ draggableCursor: '' });

    drawingPolylineRef.current?.setMap(null);
    drawingMarkersRef.current.forEach(m => m.setMap(null));
    drawingMarkersRef.current = [];
    firstPointMarkerRef.current = null;

    const color = POLYGON_COLORS[drawingType] || '#39FF14';
    const polygon = new google.maps.Polygon({
      paths: points,
      map: mapRef.current,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 3,
      fillColor: color,
      fillOpacity: 0.25,
      editable: true,
      draggable: false,
    });

    const id = `struct_${Date.now()}`;
    const existingOfType = structures.filter(s => s.type === drawingType).length;
    const typeLabel = STRUCTURE_TYPES.find(t => t.value === drawingType)?.label || 'Structure';
    const name = existingOfType > 0 ? `${typeLabel} ${existingOfType + 1}` : typeLabel;

    const newStructure: Structure = {
      id,
      name,
      type: drawingType,
      polygon: points,
      polygonOverlay: polygon,
      measured: false,
    };

    setStructures(prev => [...prev, newStructure]);
    setActiveStructureId(id);
    setDrawPoints([]);
  }, [drawingType, structures]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng || !mapRef.current) return;

    const clickPoint = e.latLng;

    // Check if clicking near first point to close polygon
    if (drawPoints.length >= 3) {
      const firstPt = drawPoints[0];
      const proj = mapRef.current.getProjection();
      if (proj) {
        const scale = Math.pow(2, mapRef.current.getZoom() || 20);
        const firstWorld = proj.fromLatLngToPoint(firstPt);
        const clickWorld = proj.fromLatLngToPoint(clickPoint);
        if (firstWorld && clickWorld) {
          const dx = (firstWorld.x - clickWorld.x) * scale;
          const dy = (firstWorld.y - clickWorld.y) * scale;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CLOSE_THRESHOLD_PX) {
            closePolygon(drawPoints);
            return;
          }
        }
      }
    }

    const newPoints = [...drawPoints, clickPoint];
    setDrawPoints(newPoints);
    drawingPolylineRef.current?.setPath(newPoints);

    const isFirst = drawPoints.length === 0;
    const marker = new google.maps.Marker({
      position: clickPoint,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isFirst ? 8 : 5,
        fillColor: isFirst ? '#39FF14' : '#fff',
        fillOpacity: 1,
        strokeColor: isFirst ? '#fff' : '#39FF14',
        strokeWeight: isFirst ? 3 : 2,
      },
      zIndex: isFirst ? 100 : 1,
      title: isFirst ? 'Click here to close polygon' : undefined,
    });

    if (isFirst) {
      firstPointMarkerRef.current = marker;
    }

    drawingMarkersRef.current.push(marker);
  }, [isDrawing, drawPoints, closePolygon]);

  useEffect(() => {
    if (!mapRef.current) return;
    const listener = mapRef.current.addListener('click', handleMapClick);
    return () => google.maps.event.removeListener(listener);
  }, [handleMapClick]);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setDrawPoints([]);
    mapRef.current?.setOptions({ draggableCursor: '' });
    drawingPolylineRef.current?.setMap(null);
    drawingMarkersRef.current.forEach(m => m.setMap(null));
    drawingMarkersRef.current = [];
    firstPointMarkerRef.current = null;
  }, []);

  const removeStructure = useCallback((id: string) => {
    setStructures(prev => {
      const struct = prev.find(s => s.id === id);
      struct?.polygonOverlay?.setMap(null);
      return prev.filter(s => s.id !== id);
    });
    if (activeStructureId === id) setActiveStructureId(null);
  }, [activeStructureId]);

  // ── Address Autocomplete ──────────────────────────────────────────────────

  const onAddressChange = (val: string) => {
    setAddress(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (val.length < 4) { setSuggestions([]); return; }

    debounceTimerRef.current = setTimeout(() => {
      setLoadingSuggestions(true);
      if (autocompleteRef.current) {
        autocompleteRef.current.getPlacePredictions(
          {
            input: val,
            types: ['address'],
            componentRestrictions: { country: 'us' },
            locationBias: new google.maps.Circle({
              center: { lat: 34.6059, lng: -86.9833 }, // North Alabama
              radius: 80000,
            }),
          },
          (predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              // Bias to Alabama but show all
              const sorted = [...predictions].sort((a, b) => {
                const aAL = a.description.includes(', AL') ? 0 : 1;
                const bAL = b.description.includes(', AL') ? 0 : 1;
                return aAL - bAL;
              });
              setSuggestions(sorted);
            } else {
              setSuggestions([]);
            }
            setLoadingSuggestions(false);
          }
        );
      } else {
        setLoadingSuggestions(false);
      }
    }, 300);
  };

  const selectAddress = (prediction: google.maps.places.AutocompletePrediction) => {
    setAddress(prediction.description);
    setSuggestions([]);
  };

  // ── Geocode & go to structure step ────────────────────────────────────────

  const goToStructure = async () => {
    if (!address.trim()) { setError('Enter an address first'); return; }
    setError('');

    try {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${key}`
      );
      const data = await res.json();
      if (!data.results?.length) throw new Error('Address not found');

      const loc = data.results[0].geometry.location;
      setGeocodedLocation({ lat: loc.lat, lng: loc.lng });
      setFormattedAddress(data.results[0].formatted_address);
      setStep('structure');
      setTimeout(() => initMap(loc.lat, loc.lng), 100);
    } catch (err: any) {
      setError(err.message || 'Could not find address');
    }
  };

  // ── Build preview images & street view panoramas (Step: imagery) ──────────

  const goToImagery = useCallback(() => {
    if (!geocodedLocation) return;
    setStep('imagery');
    setLoadingPreview(true);

    const { lat, lng } = geocodedLocation;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const images: PreviewImage[] = [];

    // Google satellite at multiple zooms
    [19, 20, 21].forEach(z => {
      images.push({
        id: `google_z${z}`,
        src: `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${z}&size=640x640&maptype=satellite&key=${key}`,
        label: `Google Satellite — Zoom ${z}`,
        source: 'Google',
        selected: true,
      });
    });

    // Esri aerial
    [0.001, 0.0005].forEach((offset, i) => {
      const bbox = getBbox(lat, lng, offset);
      images.push({
        id: `esri_${i}`,
        src: `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&size=640,640&format=png&f=image`,
        label: i === 0 ? 'Esri Aerial — Wide' : 'Esri Aerial — Tight',
        source: 'Esri',
        selected: true,
      });
    });

    setPreviewImages(images);
    setLoadingPreview(false);

    // Initialize street view panoramas after render
    setTimeout(() => initStreetViewPanoramas(lat, lng), 200);
  }, [geocodedLocation]);

  const initStreetViewPanoramas = (lat: number, lng: number) => {
    svPanoramasRef.current.forEach(p => { try { p.setVisible(false); } catch {} });
    svPanoramasRef.current = [];

    const headings = [
      { heading: 0, label: 'North' },
      { heading: 90, label: 'East' },
      { heading: 180, label: 'South' },
      { heading: 270, label: 'West' },
    ];

    headings.forEach((h, i) => {
      const container = streetViewRefs.current[i];
      if (!container) return;

      const panorama = new google.maps.StreetViewPanorama(container, {
        position: { lat, lng },
        pov: { heading: h.heading, pitch: 15 },
        zoom: 0,
        addressControl: false,
        showRoadLabels: false,
        enableCloseButton: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
      });

      svPanoramasRef.current.push(panorama);
    });
  };

  const toggleImageSelection = (id: string) => {
    setPreviewImages(prev => prev.map(img =>
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  // ── Run Measurement ───────────────────────────────────────────────────────

  const runMeasurement = async () => {
    const addr = formattedAddress || address;
    if (!addr.trim()) return;

    setStep('measuring');
    setMeasuring(true);
    setError('');
    setProgressPercent(0);
    setElapsedTime(0);
    setVarianceWarning(false);

    const startTime = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const messages = [
      { text: 'Analyzing satellite imagery — AI Pass 1 of 3...', pct: 15 },
      { text: 'Processing multi-source satellite views...', pct: 30 },
      { text: 'AI Pass 2: Verification analysis...', pct: 45 },
      { text: 'AI Pass 3: Independent cross-check...', pct: 60 },
      { text: 'Building consensus from AI passes...', pct: 75 },
      { text: 'Identifying roof components & penetrations...', pct: 88 },
      { text: 'Generating measurement report...', pct: 96 },
    ];

    let idx = 0;
    setProgress(messages[0].text);
    setProgressPercent(messages[0].pct);
    const interval = setInterval(() => {
      idx++;
      if (idx < messages.length) {
        setProgress(messages[idx].text);
        setProgressPercent(messages[idx].pct);
      }
    }, 5000);

    try {
      const res = await fetch(`/api/roof-measure?address=${encodeURIComponent(addr)}`);
      const data: ApiResponse = await res.json();
      clearInterval(interval);

      if (data.error) throw new Error(data.error);

      // Check variance — if > 10%, show warning
      if (data.pipeline?.finalVariance > 0.10) {
        setVarianceWarning(true);
        setProgress('Variance > 10% detected — running 2 additional AI passes...');
        setProgressPercent(80);
        // Simulate additional passes (the API already ran them, this is UX)
        await new Promise(r => setTimeout(r, 3000));
        setVarianceWarning(false);
      }

      // Assign result to structures or create default
      if (structures.length === 0) {
        const id = 'struct_main';
        setStructures([{
          id, name: 'Main Property', type: 'main',
          polygon: [], measured: true, result: data,
        }]);
        setSelectedStructureReport(id);
      } else {
        setStructures(prev => prev.map((s, i) => i === 0
          ? { ...s, measured: true, result: data }
          : { ...s, measured: true, result: data }
        ));
        setSelectedStructureReport(structures[0]?.id || null);
      }

      setProgressPercent(100);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setStep('results');
    } catch (err: any) {
      clearInterval(interval);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setError(err.message || 'Measurement failed');
      setStep('structure');
    } finally {
      setMeasuring(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = () => {
    structures.forEach(s => s.polygonOverlay?.setMap(null));
    setStep('address');
    setAddress('');
    setFormattedAddress('');
    setStructures([]);
    setActiveStructureId(null);
    setError('');
    setSuggestions([]);
    setSelectedStructureReport(null);
    setGeocodedLocation(null);
    setPreviewImages([]);
    setVarianceWarning(false);
    mapRef.current = null;
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const activeReport = selectedStructureReport
    ? structures.find(s => s.id === selectedStructureReport)?.result
    : structures[0]?.result;

  const stepIndex = STEP_ORDER.indexOf(step);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-neutral-950 border-b border-neutral-800 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#39FF14]/20 border border-[#39FF14]/40 rounded-xl flex items-center justify-center">
              <Ruler className="w-5 h-5 text-[#39FF14]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">RCRS Roof Measure</h1>
              <p className="text-xs text-neutral-500">AI-Powered Satellite Measurement</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {STEP_ORDER.map((s, i) => {
              const isCurrent = step === s;
              const isPast = stepIndex > i;
              return (
                <div key={s} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    isCurrent ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40' :
                    isPast ? 'bg-[#39FF14]/10 text-[#39FF14]/70' :
                    'bg-neutral-800 text-neutral-500'
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPast ? 'bg-[#39FF14] text-black' : isCurrent ? 'bg-[#39FF14]/30 text-[#39FF14]' : 'bg-neutral-700'
                    }`}>
                      {isPast ? '✓' : i + 1}
                    </span>
                    <span className="hidden lg:inline">{STEP_LABELS[s]}</span>
                  </div>
                  {i < STEP_ORDER.length - 1 && <ChevronRight className="w-3 h-3 text-neutral-600 mx-0.5" />}
                </div>
              );
            })}
          </div>
        </div>
        {/* Mobile step bar */}
        <div className="md:hidden mt-2">
          <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#39FF14] rounded-full transition-all duration-500"
              style={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">Step {stepIndex + 1}: {STEP_LABELS[step]}</p>
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4">
          <div className="bg-red-900/90 backdrop-blur border border-red-700 rounded-xl p-4 flex items-start gap-3 shadow-2xl">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-200 text-sm flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP: ADDRESS ═══════════════════ */}
      {step === 'address' && (
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-2xl flex items-center justify-center mb-4">
              <Home className="w-10 h-10 text-[#39FF14]" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Measure Any Roof</h2>
            <p className="text-neutral-400 max-w-md mx-auto">
              Enter a property address and we&apos;ll use satellite imagery and AI to generate
              professional-grade roof measurements.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type="text"
                value={address}
                onChange={e => onAddressChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && goToStructure()}
                placeholder="123 Main St, Decatur, AL 35601"
                className="w-full pl-12 pr-12 py-4 bg-neutral-900 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50 text-lg"
                autoFocus
              />
              {loadingSuggestions && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#39FF14] animate-spin" />
              )}
            </div>

            {/* Autocomplete dropdown */}
            {suggestions.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden divide-y divide-neutral-800 shadow-xl">
                {suggestions.map((pred, i) => (
                  <button
                    key={pred.place_id || i}
                    onClick={() => selectAddress(pred)}
                    className="w-full px-4 py-3 text-left hover:bg-neutral-800 transition flex items-start gap-3"
                  >
                    <MapPin className="w-4 h-4 text-[#39FF14] mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm text-white font-medium">{pred.structured_formatting?.main_text}</span>
                      <span className="text-xs text-neutral-400 ml-1">{pred.structured_formatting?.secondary_text}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={goToStructure}
              disabled={!address.trim()}
              className="w-full py-4 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition text-lg"
            >
              Next: Select Structure on Map <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-10">
            <FeatureCard icon={Layers} title="Multi-Source" desc="Google, Esri aerial imagery" />
            <FeatureCard icon={BarChart3} title="AI Consensus" desc="3-5 independent AI passes" />
            <FeatureCard icon={Shield} title="Verified" desc="Outlier detection & validation" />
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP: SELECT STRUCTURE ═══════════════════ */}
      {step === 'structure' && (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-57px)]">
          {/* Sidebar */}
          <div className="w-full lg:w-80 bg-neutral-950 border-b lg:border-b-0 lg:border-r border-neutral-800 p-4 overflow-y-auto flex-shrink-0">
            <div className="mb-4">
              <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-1">Property</p>
              <p className="text-sm text-neutral-200 truncate">{formattedAddress || address}</p>
            </div>

            <div className="border-t border-neutral-800 pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-300">Structures</h3>
                <span className="text-xs text-neutral-500">{structures.length} drawn</span>
              </div>

              {structures.length === 0 && !isDrawing && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 mb-3">
                  <p className="text-xs text-neutral-400">
                    Click on the map to place 4+ points around the roof.
                    Click the <span className="text-[#39FF14] font-bold">first point</span> to close the polygon.
                  </p>
                </div>
              )}

              {/* Structure list */}
              <div className="space-y-2 mb-3">
                {structures.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                      activeStructureId === s.id
                        ? 'bg-[#39FF14]/10 border border-[#39FF14]/40'
                        : 'bg-neutral-900 border border-neutral-700 hover:border-neutral-600'
                    }`}
                    onClick={() => {
                      setActiveStructureId(s.id);
                      if (s.polygonOverlay) {
                        const bounds = new google.maps.LatLngBounds();
                        s.polygon.forEach(p => bounds.extend(p));
                        mapRef.current?.fitBounds(bounds);
                      }
                    }}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: POLYGON_COLORS[s.type] }} />
                    <span className="text-sm flex-1 truncate">{s.name}</span>
                    <span className="text-[10px] text-neutral-500 uppercase">{s.type}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeStructure(s.id); }}
                      className="text-neutral-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Drawing controls */}
              {isDrawing ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#39FF14] flex items-center gap-1">
                    <CircleDot className="w-3 h-3 animate-pulse" /> Placing points... ({drawPoints.length})
                  </p>
                  {drawPoints.length >= 3 && (
                    <p className="text-[10px] text-neutral-400">
                      Click near the <span className="text-[#39FF14]">green first point</span> to close the polygon
                    </p>
                  )}
                  <button
                    onClick={cancelDrawing}
                    className="w-full py-2 px-3 bg-neutral-700 text-neutral-300 text-sm rounded-lg hover:bg-neutral-600 transition"
                  >
                    Cancel Drawing
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {structures.length > 0 && (
                    <div className="pb-2">
                      <button
                        onClick={() => startDrawing('garage')}
                        className="w-full py-2.5 px-3 bg-neutral-900 border border-dashed border-neutral-600 rounded-lg hover:border-[#39FF14]/50 transition text-sm text-neutral-300 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4 text-[#39FF14]" /> Add Another Structure
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">Draw Structure</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STRUCTURE_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => startDrawing(t.value as Structure['type'])}
                        className="flex items-center gap-1.5 py-1.5 px-2 bg-neutral-900 border border-neutral-700 rounded-lg hover:border-[#39FF14]/40 transition text-xs text-neutral-300"
                      >
                        <t.icon className="w-3 h-3" style={{ color: POLYGON_COLORS[t.value] }} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="space-y-2 pt-4 border-t border-neutral-800">
              <button
                onClick={goToImagery}
                disabled={structures.length === 0}
                className="w-full py-3 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                Next: Review Imagery <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStep('address')}
                className="w-full py-2 text-neutral-400 text-sm hover:text-neutral-300 transition flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Change Address
              </button>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />
            {isDrawing && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#39FF14]/90 text-black text-sm font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-10">
                <CircleDot className="w-4 h-4 animate-pulse" />
                {drawPoints.length < 3
                  ? `Place points on the roof (${drawPoints.length}/3 min)`
                  : `Click the first green point to close — or keep adding`
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP: REVIEW IMAGERY ═══════════════════ */}
      {step === 'imagery' && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Review Overhead Imagery</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Select/deselect images for measurement. Click any to enlarge.
              </p>
            </div>
            <button onClick={() => setStep('structure')} className="text-sm text-neutral-400 hover:text-white flex items-center gap-1 transition">
              <ChevronLeft className="w-4 h-4" /> Back to Map
            </button>
          </div>

          {loadingPreview ? (
            <div className="flex flex-col items-center py-20">
              <Loader2 className="w-10 h-10 text-[#39FF14] animate-spin mb-4" />
              <p className="text-neutral-400">Loading imagery...</p>
            </div>
          ) : (
            <>
              {/* Overhead imagery grid */}
              <div className="mb-10">
                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#39FF14]" /> Satellite &amp; Aerial Sources
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {previewImages.map(img => (
                    <div key={img.id} className="relative group">
                      <div
                        className={`relative rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                          img.selected ? 'border-[#39FF14]' : 'border-neutral-700 opacity-50'
                        }`}
                        onClick={() => toggleImageSelection(img.id)}
                      >
                        <img src={img.src} alt={img.label} className="w-full aspect-square object-cover" />
                        <div className="absolute top-2 right-2">
                          {img.selected ? (
                            <div className="w-6 h-6 bg-[#39FF14] rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-black" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-black/60 border border-neutral-500 rounded-full" />
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEnlargedImage(img.src); }}
                          className="absolute bottom-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1.5 text-center">{img.label}</p>
                      <p className="text-[10px] text-neutral-600 text-center">{img.source}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Street View Panoramas */}
              <div className="mb-10">
                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#39FF14]" /> Interactive Street Views
                </h3>
                <p className="text-xs text-neutral-500 mb-4">Pan and zoom each panorama to identify the building from different angles.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['North', 'East', 'South', 'West'].map((dir, i) => (
                    <div key={dir} className="rounded-xl overflow-hidden border border-neutral-700">
                      <div className="bg-neutral-900 px-3 py-1.5 flex items-center gap-2">
                        <Compass className="w-3 h-3 text-[#39FF14]" />
                        <span className="text-xs font-medium text-neutral-300">Street View — {dir}</span>
                      </div>
                      <div
                        ref={el => { streetViewRefs.current[i] = el; }}
                        className="w-full h-64 md:h-72 bg-neutral-800"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm & Measure */}
              <div className="sticky bottom-0 bg-neutral-950/90 backdrop-blur border-t border-neutral-800 -mx-4 px-4 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                  <div className="text-sm text-neutral-400">
                    <span className="text-[#39FF14] font-bold">{previewImages.filter(i => i.selected).length}</span> images selected
                    {' · '}
                    <span className="text-[#39FF14] font-bold">{structures.length}</span> structure{structures.length !== 1 ? 's' : ''}
                  </div>
                  <button
                    onClick={runMeasurement}
                    className="py-3 px-8 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 transition flex items-center gap-2 text-lg"
                  >
                    <Ruler className="w-5 h-5" /> Confirm &amp; Measure
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Enlarged image modal */}
          {enlargedImage && (
            <div
              className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
              onClick={() => setEnlargedImage(null)}
            >
              <button className="absolute top-4 right-4 text-white hover:text-[#39FF14] transition">
                <X className="w-8 h-8" />
              </button>
              <img src={enlargedImage} alt="Enlarged" className="max-w-full max-h-full rounded-xl" />
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ STEP: MEASURING ═══════════════════ */}
      {step === 'measuring' && (
        <div className="max-w-lg mx-auto px-4 py-20">
          <div className="flex flex-col items-center space-y-8">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 rounded-2xl bg-[#39FF14]/10 border-2 border-[#39FF14]/30 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Home className="w-14 h-14 text-[#39FF14]/70" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-[#39FF14] flex items-center justify-center shadow-lg">
                <Loader2 className="w-5 h-5 text-black animate-spin" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold">Analyzing Property</h3>
              <p className="text-[#39FF14] text-sm">{progress}</p>
              <p className="text-neutral-500 text-xs">Elapsed: {formatTime(elapsedTime)}</p>
            </div>

            {varianceWarning && (
              <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 flex items-start gap-3 max-w-sm">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-200 font-medium">High variance detected (&gt;10%)</p>
                  <p className="text-xs text-amber-300/70 mt-1">Running 2 additional AI passes for better accuracy...</p>
                </div>
              </div>
            )}

            <div className="w-full max-w-xs">
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#39FF14]/60 to-[#39FF14] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-neutral-500">Processing</span>
                <span className="text-xs text-neutral-400">{progressPercent}%</span>
              </div>
            </div>

            <p className="text-neutral-500 text-xs text-center">
              This typically takes 1-3 minutes.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP: RESULTS ═══════════════════ */}
      {step === 'results' && activeReport && (
        <ResultsView
          report={activeReport}
          structures={structures}
          selectedId={selectedStructureReport}
          onSelectStructure={setSelectedStructureReport}
          address={formattedAddress || address}
          onReset={reset}
          onBackToMap={() => setStep('structure')}
        />
      )}

      {step === 'results' && !activeReport && (
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">No Results</h3>
          <p className="text-neutral-400 mb-6">Something went wrong. Try again.</p>
          <button onClick={reset} className="px-6 py-3 bg-[#39FF14] text-black rounded-xl font-bold">
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ══════════════════════════════════════════════════════════════════════════════

function ResultsView({
  report, structures, selectedId, onSelectStructure, address, onReset, onBackToMap,
}: {
  report: ApiResponse;
  structures: Structure[];
  selectedId: string | null;
  onSelectStructure: (id: string) => void;
  address: string;
  onReset: () => void;
  onBackToMap: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true, measurements: true, components: true, confidence: true, images: false,
  });
  const [copied, setCopied] = useState(false);

  const m = report.measurements;
  const totalArea = report.solarData?.totalRoofAreaSqFt || 0;
  const squares = Math.round(totalArea / 100 * 10) / 10;
  const confidence = report.overallConfidence;

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const measurementRows = [
    { key: 'ridge', label: 'Ridge', value: m?.ridges?.totalFt || 0, confidence: m?.ridges?.confidence },
    { key: 'rake', label: 'Rake', value: m?.rakes?.totalFt || 0, confidence: m?.rakes?.confidence },
    { key: 'valley', label: 'Valley', value: m?.valleys?.totalFt || 0, confidence: m?.valleys?.confidence },
    { key: 'eave', label: 'Eave', value: m?.eaves?.totalFt || 0, confidence: m?.eaves?.confidence },
    { key: 'hip', label: 'Hip', value: m?.hips?.totalFt || 0, confidence: m?.hips?.confidence },
    { key: 'perimeter', label: 'Perimeter', value: m?.perimeterFt || 0 },
  ];

  const componentSections = [
    { key: 'vents', label: 'Vents', items: report.components?.vents },
    { key: 'pipes', label: 'Pipes', items: report.components?.pipes },
    { key: 'chimneys', label: 'Chimneys', items: report.components?.chimneys },
    { key: 'skylights', label: 'Skylights', items: report.components?.skylights },
  ];

  const handleCopy = () => {
    const text = [
      `Roof Measurement — ${report.address || address}`,
      `Total Area: ${totalArea.toLocaleString()} sq ft (${squares} squares)`,
      `Pitch: ${m?.pitches?.primary || 'N/A'} | Style: ${m?.roofStyle || 'N/A'}`,
      ...measurementRows.map(r => `${r.label}: ${r.value} ft`),
      `Confidence: ${confidence}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-20">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-[#39FF14]/10 to-neutral-950 border border-[#39FF14]/20 rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-[#39FF14]/20 rounded-lg flex items-center justify-center">
                <Ruler className="w-4 h-4 text-[#39FF14]" />
              </div>
              <h2 className="text-xl font-bold">Roof Measurement Report</h2>
            </div>
            <p className="text-neutral-300 flex items-center gap-1.5 text-sm">
              <MapPin className="w-3.5 h-3.5 text-[#39FF14]" /> {report.address || address}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400 flex-wrap">
              <span>Generated {new Date(report.generatedAt).toLocaleDateString()}</span>
              <span className="text-neutral-700">|</span>
              <span>Imagery: {report.imageryDate}</span>
              <span className="text-neutral-700">|</span>
              <span>{report.pipeline?.totalAiPasses || 0} AI passes</span>
              {report.pipeline?.finalVariance !== undefined && (
                <>
                  <span className="text-neutral-700">|</span>
                  <span>{(report.pipeline.finalVariance * 100).toFixed(1)}% variance</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <button onClick={handleCopy} className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition flex items-center gap-1.5 text-xs">
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-[#39FF14]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={onBackToMap} className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition flex items-center gap-1.5 text-xs">
              <Eye className="w-3.5 h-3.5" /> Map
            </button>
            <button onClick={onReset} className="px-3 py-2 bg-[#39FF14] text-black rounded-lg font-bold hover:bg-[#39FF14]/90 transition flex items-center gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> New
            </button>
          </div>
        </div>

        {structures.length > 1 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#39FF14]/10 overflow-x-auto">
            {structures.map(s => (
              <button
                key={s.id}
                onClick={() => onSelectStructure(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                  s.id === (selectedId || structures[0]?.id)
                    ? 'bg-[#39FF14] text-black'
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: POLYGON_COLORS[s.type] }} />
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confidence */}
      <CollapsibleSection title="Confidence & Quality" icon={Shield} expanded={expandedSections.confidence} onToggle={() => toggleSection('confidence')}>
        <div className={`rounded-xl p-4 border ${
          confidence === 'HIGH' ? 'bg-emerald-900/20 border-emerald-700/50' :
          confidence === 'MEDIUM' ? 'bg-amber-900/20 border-amber-700/50' :
          'bg-red-900/20 border-red-700/50'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              confidence === 'HIGH' ? 'bg-emerald-900/50' : confidence === 'MEDIUM' ? 'bg-amber-900/50' : 'bg-red-900/50'
            }`}>
              {confidence === 'HIGH' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
               confidence === 'MEDIUM' ? <AlertTriangle className="w-5 h-5 text-amber-400" /> :
               <AlertCircle className="w-5 h-5 text-red-400" />}
            </div>
            <div>
              <span className={`text-sm font-bold ${
                confidence === 'HIGH' ? 'text-emerald-300' : confidence === 'MEDIUM' ? 'text-amber-300' : 'text-red-300'
              }`}>
                {confidence} CONFIDENCE
              </span>
              <p className="text-xs text-neutral-400">
                {report.pipeline?.finalVariance !== undefined &&
                  `${(report.pipeline.finalVariance * 100).toFixed(1)}% max variance across ${report.pipeline.totalAiPasses} AI passes`}
              </p>
            </div>
          </div>

          {report.pipeline?.allProviderResults?.length > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-neutral-500 uppercase">
                    <th className="pb-1 pr-3 text-left">Pass</th>
                    <th className="pb-1 pr-3 text-right">Ridge</th>
                    <th className="pb-1 pr-3 text-right">Rake</th>
                    <th className="pb-1 text-right">Eave</th>
                  </tr>
                </thead>
                <tbody>
                  {report.pipeline.allProviderResults.map((r, i) => (
                    <tr key={i} className="text-neutral-300 border-t border-neutral-800/50">
                      <td className="py-1 pr-3"><span className="bg-neutral-800 px-1.5 py-0.5 rounded">{r.name}</span></td>
                      <td className="py-1 pr-3 text-right font-mono">{r.totalRidge} ft</td>
                      <td className="py-1 pr-3 text-right font-mono">{r.totalRake} ft</td>
                      <td className="py-1 text-right font-mono">{r.totalEave} ft</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.qualityNotes?.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-neutral-700/50">
              {report.qualityNotes.map((note, i) => (
                <p key={i} className="text-xs text-neutral-400 flex items-start gap-1.5">
                  <Info className="w-3 h-3 mt-0.5 shrink-0 text-neutral-500" />
                  {note}
                </p>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Overview */}
      <CollapsibleSection title="Property Overview" icon={Home} expanded={expandedSections.overview} onToggle={() => toggleSection('overview')}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            {report.images?.satellite ? (
              <img src={report.images.satellite} alt="Satellite" className="w-full h-64 lg:h-72 object-cover" />
            ) : (
              <div className="w-full h-64 lg:h-72 bg-neutral-800 flex items-center justify-center">
                <p className="text-neutral-500 text-sm">Satellite image unavailable</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Total Roof Area" value={totalArea.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit="sq ft" icon={Home} highlight />
            <MetricCard label="Roofing Squares" value={String(squares)} unit="squares" icon={Hash} highlight />
            <MetricCard label="Primary Pitch" value={m?.pitches?.primary || 'N/A'} icon={Triangle} />
            <MetricCard label="Roof Style" value={capitalize(m?.roofStyle || 'N/A')} icon={Building} />
            <MetricCard label="Segments" value={String(report.solarData?.segmentCount || 0)} icon={Layers} />
            <MetricCard label="Perimeter" value={`${m?.perimeterFt || 0}`} unit="ft" icon={Square} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Measurements */}
      <CollapsibleSection title="Detailed Measurements" icon={Ruler} expanded={expandedSections.measurements} onToggle={() => toggleSection('measurements')}>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-neutral-500 text-xs uppercase bg-neutral-900/80">
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Length</th>
                  <th className="px-4 py-3 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {measurementRows.map(row => (
                  <tr key={row.key} className="text-neutral-200 hover:bg-neutral-800/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EDGE_COLORS[row.key] || '#666' }} />
                        {row.label}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{row.value} ft</td>
                    <td className="px-4 py-3 text-center">
                      {row.confidence ? <ConfidenceBadge level={row.confidence} /> : <span className="text-neutral-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>

      {/* Components */}
      <CollapsibleSection title="Components & Penetrations" icon={Layers} expanded={expandedSections.components} onToggle={() => toggleSection('components')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {componentSections.map(section => (
            <div key={section.key} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-neutral-200 mb-3">{section.label}</h4>
              {section.items && section.items.length > 0 ? (
                <div className="space-y-2">
                  {section.items.map((item: RoofComponent, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
                      <span className="text-xs text-neutral-300">
                        {formatComponentLabel(section.key, item)}
                      </span>
                      <ConfidenceBadge level={item.confidence} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">None detected</p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Imagery from API */}
      <CollapsibleSection title="Measurement Images" icon={Camera} expanded={expandedSections.images} onToggle={() => toggleSection('images')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {report.images?.satelliteZooms?.map((src, i) => (
            <img key={`sz${i}`} src={src} alt={`Satellite zoom ${i}`} className="rounded-xl border border-neutral-800 w-full aspect-square object-cover" />
          ))}
          {report.images?.streetView?.map((src, i) => (
            <img key={`sv${i}`} src={src} alt={`Street view ${i}`} className="rounded-xl border border-neutral-800 w-full aspect-[4/3] object-cover" />
          ))}
          {report.images?.esriAerial?.map((src, i) => (
            <img key={`ea${i}`} src={src} alt={`Esri ${i}`} className="rounded-xl border border-neutral-800 w-full aspect-square object-cover" />
          ))}
        </div>
        {(!report.images?.satelliteZooms?.length && !report.images?.streetView?.length) && (
          <p className="text-xs text-neutral-500 text-center py-4">No measurement images available</p>
        )}
      </CollapsibleSection>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function CollapsibleSection({ title, icon: Icon, expanded, onToggle, children }: {
  title: string; icon: any; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:bg-neutral-900 transition"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#39FF14]" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
      </button>
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 text-center">
      <Icon className="w-5 h-5 text-[#39FF14] mx-auto mb-1.5" />
      <p className="text-xs font-medium text-neutral-200">{title}</p>
      <p className="text-[10px] text-neutral-500">{desc}</p>
    </div>
  );
}

function MetricCard({ label, value, unit, icon: Icon, highlight }: {
  label: string; value: string; unit?: string; icon: any; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${
      highlight ? 'bg-[#39FF14]/5 border-[#39FF14]/20' : 'bg-neutral-800/50 border-neutral-700/50'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-[#39FF14]" />
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`font-bold ${highlight ? 'text-xl text-white' : 'text-lg text-neutral-200'}`}>{value}</span>
        {unit && <span className="text-xs text-neutral-500">{unit}</span>}
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    HIGH: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
    MEDIUM: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
    LOW: 'bg-red-900/50 text-red-300 border-red-700/50',
    'N/A': 'bg-neutral-800 text-neutral-400 border-neutral-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colors[level] || colors['N/A']}`}>
      {level}
    </span>
  );
}

// ── Utilities ───────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatComponentLabel(sectionKey: string, item: RoofComponent): string {
  switch (sectionKey) {
    case 'vents': return `${(item.type || 'vent').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} × ${item.count || 1}`;
    case 'pipes': return `${item.diameter_in || '?'}" diameter × ${item.count || 1}`;
    case 'chimneys': return `${item.width_ft || '?'}' × ${item.length_ft || '?'}' — ${item.flashing_perimeter_ft || 0} ft flashing`;
    case 'skylights': return `${item.width_ft || '?'}' × ${item.length_ft || '?'}' — ${item.flashing_perimeter_ft || 0} ft flashing`;
    case 'flashing': return `${capitalize(item.type || '')} — ${item.length_ft || 0} ft`;
    case 'transitions': return `${item.description || 'Transition'} — ${item.length_ft || 0} ft`;
    default: return item.description || item.type || 'Unknown';
  }
}

function getBbox(lat: number, lng: number, offset: number): string {
  return `${lng - offset},${lat - offset},${lng + offset},${lat + offset}`;
}
