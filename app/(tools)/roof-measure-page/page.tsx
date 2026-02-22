'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, MapPin, Loader2, Ruler, CheckCircle, AlertCircle, AlertTriangle,
  CloudLightning, Home, Hash, Building, Copy, ExternalLink, ChevronRight,
  ChevronLeft, Plus, Trash2, Printer, Eye, Download, BarChart3, Shield,
  Layers, Triangle, Wind, Droplets, CircleDot, Square, Info, X, Maximize2,
  ArrowRight, Warehouse, TreePine, Gauge, Camera, Upload, FileText, Share2,
  Image as ImageIcon, Check, ZoomIn, Clock, Users, ChevronDown, ChevronUp,
  Edit3, RotateCcw
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6;

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

interface ManualOverride {
  [key: string]: string;
}

interface ComponentOverride {
  [key: string]: string;
}

interface UploadedPhoto {
  file: File;
  label: string;
  preview: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STEP_LABELS = ['Address', 'Select Structure', 'Verify Imagery', 'Measuring', 'Results', 'Export'];

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

const PHOTO_LABELS = ['Front', 'Back', 'Left Side', 'Right Side', 'Drone Overhead', 'Close-up', 'Other'];

// ── Main Component ──────────────────────────────────────────────────────────

export default function RoofMeasureTool() {
  // Core state
  const [step, setStep] = useState<Step>(1);
  const [address, setAddress] = useState('');
  const [formattedAddress, setFormattedAddress] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
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

  // Imagery verification state
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Measurement state
  const [measuring, setMeasuring] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedStructureReport, setSelectedStructureReport] = useState<string | null>(null);

  // Manual override state
  const [manualOverrides, setManualOverrides] = useState<Record<string, ManualOverride>>({});
  const [componentOverrides, setComponentOverrides] = useState<Record<string, ComponentOverride>>({});

  // Photo upload state
  const [photoMode, setPhotoMode] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);

  // Print mode
  const [printMode, setPrintMode] = useState<'full' | 'summary' | 'crew' | null>(null);

  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const drawingPolylineRef = useRef<google.maps.Polyline | null>(null);
  const drawingMarkersRef = useRef<google.maps.Marker[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry,drawing`;
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
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
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

  // ── Drawing Handlers ──────────────────────────────────────────────────────

  const startDrawing = useCallback((type: Structure['type'] = 'main') => {
    if (!mapRef.current) return;
    setIsDrawing(true);
    setDrawPoints([]);
    setDrawingType(type);
    mapRef.current.setOptions({ draggableCursor: 'crosshair' });

    drawingPolylineRef.current?.setMap(null);
    drawingMarkersRef.current.forEach(m => m.setMap(null));
    drawingMarkersRef.current = [];

    const polyline = new google.maps.Polyline({
      map: mapRef.current,
      strokeColor: POLYGON_COLORS[type] || '#39FF14',
      strokeOpacity: 0.8,
      strokeWeight: 3,
    });
    drawingPolylineRef.current = polyline;
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng || !mapRef.current) return;

    const point = e.latLng;
    setDrawPoints(prev => {
      const newPoints = [...prev, point];
      drawingPolylineRef.current?.setPath(newPoints);
      return newPoints;
    });

    const marker = new google.maps.Marker({
      position: point,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: '#fff',
        fillOpacity: 1,
        strokeColor: '#39FF14',
        strokeWeight: 2,
      },
    });
    drawingMarkersRef.current.push(marker);
  }, [isDrawing]);

  useEffect(() => {
    if (!mapRef.current) return;
    const listener = mapRef.current.addListener('click', handleMapClick);
    return () => google.maps.event.removeListener(listener);
  }, [handleMapClick]);

  const finishDrawing = useCallback(() => {
    if (drawPoints.length < 3) {
      setError('Draw at least 3 points to define a structure');
      return;
    }
    setIsDrawing(false);
    mapRef.current?.setOptions({ draggableCursor: '' });

    drawingPolylineRef.current?.setMap(null);
    drawingMarkersRef.current.forEach(m => m.setMap(null));
    drawingMarkersRef.current = [];

    const color = POLYGON_COLORS[drawingType] || '#39FF14';
    const polygon = new google.maps.Polygon({
      paths: drawPoints,
      map: mapRef.current!,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 3,
      fillColor: color,
      fillOpacity: 0.2,
      editable: true,
    });

    const id = `struct_${Date.now()}`;
    const typeLabel = STRUCTURE_TYPES.find(t => t.value === drawingType)?.label || 'Structure';
    const newStructure: Structure = {
      id,
      name: typeLabel,
      type: drawingType,
      polygon: drawPoints,
      polygonOverlay: polygon,
      measured: false,
    };

    setStructures(prev => [...prev, newStructure]);
    setActiveStructureId(id);
    setDrawPoints([]);
  }, [drawPoints, drawingType]);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setDrawPoints([]);
    mapRef.current?.setOptions({ draggableCursor: '' });
    drawingPolylineRef.current?.setMap(null);
    drawingMarkersRef.current.forEach(m => m.setMap(null));
    drawingMarkersRef.current = [];
  }, []);

  const removeStructure = useCallback((id: string) => {
    setStructures(prev => {
      const struct = prev.find(s => s.id === id);
      struct?.polygonOverlay?.setMap(null);
      return prev.filter(s => s.id !== id);
    });
    if (activeStructureId === id) setActiveStructureId(null);
  }, [activeStructureId]);

  const autoSelectMainStructure = useCallback(() => {
    if (!geocodedLocation || !mapRef.current) return;
    const { lat, lng } = geocodedLocation;
    const latOffset = 0.00008;
    const lngOffset = 0.00010;

    const points = [
      new google.maps.LatLng(lat - latOffset, lng - lngOffset),
      new google.maps.LatLng(lat - latOffset, lng + lngOffset),
      new google.maps.LatLng(lat + latOffset, lng + lngOffset),
      new google.maps.LatLng(lat + latOffset, lng - lngOffset),
    ];

    const color = POLYGON_COLORS.main;
    const polygon = new google.maps.Polygon({
      paths: points,
      map: mapRef.current,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 3,
      fillColor: color,
      fillOpacity: 0.2,
      editable: true,
    });

    const id = `struct_${Date.now()}`;
    setStructures(prev => [...prev, {
      id, name: 'Main House', type: 'main' as const,
      polygon: points, polygonOverlay: polygon, measured: false,
    }]);
    setActiveStructureId(id);
  }, [geocodedLocation]);

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
              center: { lat: 34.6059, lng: -86.9833 },
              radius: 80000,
            }),
          },
          (predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              const alabamaOnly = predictions
                .filter(p => p.description.includes(', AL') || p.description.includes('Alabama'))
                .map(p => p.description);
              setSuggestions(alabamaOnly.length > 0 ? alabamaOnly : predictions.map(p => p.description));
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

  const selectAddress = (addr: string) => {
    setAddress(addr);
    setSuggestions([]);
  };

  // ── Geocode & Proceed ─────────────────────────────────────────────────────

  const goToStep2 = async () => {
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
      setStep(2);
      setTimeout(() => initMap(loc.lat, loc.lng), 100);
    } catch (err: any) {
      setError(err.message || 'Could not find address');
    }
  };

  // ── Fetch Preview Images (Step 3) ─────────────────────────────────────────

  const fetchPreviewImages = useCallback(async () => {
    if (!geocodedLocation) return;
    setLoadingPreview(true);

    const { lat, lng } = geocodedLocation;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const images: PreviewImage[] = [];

    // Google satellite at different zoom levels
    [20, 21, 19].forEach((z, i) => {
      images.push({
        id: `google_z${z}`,
        src: `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${z}&size=640x640&maptype=satellite&key=${key}`,
        label: `Google Satellite Zoom ${z}`,
        source: 'Google',
        selected: true,
      });
    });

    // Esri aerial
    const esriBbox = getBbox(lat, lng, 0.001);
    images.push({
      id: 'esri_wide',
      src: `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${esriBbox}&size=640,640&format=png&f=image`,
      label: 'Esri Aerial Wide',
      source: 'Esri',
      selected: true,
    });

    const esriBboxTight = getBbox(lat, lng, 0.0005);
    images.push({
      id: 'esri_tight',
      src: `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${esriBboxTight}&size=640,640&format=png&f=image`,
      label: 'Esri Aerial Tight',
      source: 'Esri',
      selected: true,
    });

    // Street views from 4 cardinal directions
    const headings = [
      { h: 0, label: 'North' }, { h: 90, label: 'East' },
      { h: 180, label: 'South' }, { h: 270, label: 'West' },
    ];
    headings.forEach(({ h, label }) => {
      images.push({
        id: `sv_${label.toLowerCase()}`,
        src: `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&heading=${h}&pitch=15&fov=90&key=${key}`,
        label: `Street View — ${label}`,
        source: 'Street View',
        selected: true,
      });
    });

    setPreviewImages(images);
    setLoadingPreview(false);
  }, [geocodedLocation]);

  const goToStep3 = () => {
    setStep(3);
    fetchPreviewImages();
  };

  const toggleImageSelection = (id: string) => {
    setPreviewImages(prev => prev.map(img =>
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  const selectedImageCount = previewImages.filter(i => i.selected).length;

  // ── Photo Upload ──────────────────────────────────────────────────────────

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: UploadedPhoto[] = files.map(file => ({
      file,
      label: 'Front',
      preview: URL.createObjectURL(file),
    }));
    setUploadedPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (idx: number) => {
    setUploadedPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updatePhotoLabel = (idx: number, label: string) => {
    setUploadedPhotos(prev => prev.map((p, i) => i === idx ? { ...p, label } : p));
  };

  // ── Run Measurement (Step 4) ──────────────────────────────────────────────

  const runMeasurement = async () => {
    const addr = formattedAddress || address;
    if (!addr.trim()) return;

    setStep(4);
    setMeasuring(true);
    setError('');
    setProgressPercent(0);
    setElapsedTime(0);

    // Start elapsed timer
    const startTime = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const messages = [
      { text: 'Analyzing satellite imagery with AI Pass 1 of 3...', pct: 15 },
      { text: 'Processing multi-source satellite views...', pct: 30 },
      { text: 'AI Pass 2: Verification analysis...', pct: 45 },
      { text: 'AI Pass 3: Independent cross-check...', pct: 60 },
      { text: 'Running verification pass...', pct: 72 },
      { text: 'Building consensus from AI passes...', pct: 82 },
      { text: 'Identifying roof components & penetrations...', pct: 90 },
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
    }, 6000);

    try {
      const hasPhotos = uploadedPhotos.length > 0;

      if (hasPhotos) {
        // POST with photos (enhanced mode)
        const formData = new FormData();
        formData.append('address', addr);
        formData.append('mode', 'enhanced');
        const labels: Record<string, string> = {};
        uploadedPhotos.forEach((p, i) => {
          formData.append('photos', p.file);
          labels[`photo_${i}`] = p.label;
        });
        formData.append('photoLabels', JSON.stringify(labels));

        const res = await fetch('/api/roof-measure', { method: 'POST', body: formData });
        const data = await res.json();
        clearInterval(interval);

        if (data.error) throw new Error(data.error);

        const id = 'struct_main';
        setStructures([{
          id, name: 'Main Property', type: 'main',
          polygon: [], measured: true, result: data,
        }]);
        setSelectedStructureReport(id);
      } else if (structures.length === 0) {
        const res = await fetch(`/api/roof-measure?address=${encodeURIComponent(addr)}`);
        const data = await res.json();
        clearInterval(interval);
        if (data.error) throw new Error(data.error);

        const id = 'struct_main';
        setStructures([{
          id, name: 'Main Property', type: 'main',
          polygon: [], measured: true, result: data,
        }]);
        setSelectedStructureReport(id);
      } else {
        const updated = [...structures];
        for (let i = 0; i < updated.length; i++) {
          setProgress(`Measuring ${updated[i].name} (${i + 1}/${updated.length})...`);
          setProgressPercent(Math.round(10 + (80 * i / updated.length)));

          const res = await fetch(`/api/roof-measure?address=${encodeURIComponent(addr)}`);
          const data = await res.json();

          if (data.error) {
            updated[i].error = data.error;
            updated[i].measured = true;
          } else {
            updated[i].result = data;
            updated[i].measured = true;
          }
        }
        clearInterval(interval);
        setStructures(updated);
        setSelectedStructureReport(updated[0]?.id || null);
      }

      setProgressPercent(100);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setStep(5);
    } catch (err: any) {
      clearInterval(interval);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setError(err.message || 'Measurement failed');
      setStep(photoMode ? 1 : 2);
    } finally {
      setMeasuring(false);
    }
  };

  // ── Manual Override Helpers ────────────────────────────────────────────────

  const getOverride = (structId: string, key: string) => manualOverrides[structId]?.[key] || '';
  const setOverride = (structId: string, key: string, val: string) => {
    setManualOverrides(prev => ({
      ...prev,
      [structId]: { ...(prev[structId] || {}), [key]: val },
    }));
  };

  const getComponentOverride = (structId: string, key: string) => componentOverrides[structId]?.[key] || '';
  const setComponentOverride = (structId: string, key: string, val: string) => {
    setComponentOverrides(prev => ({
      ...prev,
      [structId]: { ...(prev[structId] || {}), [key]: val },
    }));
  };

  const getFinalValue = (structId: string, key: string, aiValue: number): { value: number; fieldVerified: boolean } => {
    const override = getOverride(structId, key);
    if (override && !isNaN(parseFloat(override))) {
      return { value: parseFloat(override), fieldVerified: true };
    }
    return { value: aiValue, fieldVerified: false };
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = () => {
    structures.forEach(s => s.polygonOverlay?.setMap(null));
    uploadedPhotos.forEach(p => URL.revokeObjectURL(p.preview));
    setStep(1);
    setAddress('');
    setFormattedAddress('');
    setStructures([]);
    setActiveStructureId(null);
    setError('');
    setSuggestions([]);
    setSelectedStructureReport(null);
    setGeocodedLocation(null);
    setPreviewImages([]);
    setUploadedPhotos([]);
    setPhotoMode(false);
    setManualOverrides({});
    setComponentOverrides({});
    setPrintMode(null);
    mapRef.current = null;
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Helper active report
  const activeReport = selectedStructureReport
    ? structures.find(s => s.id === selectedStructureReport)?.result
    : structures[0]?.result;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Header with Progress Bar ─────────────────────────────────────── */}
      <header className="bg-gray-950 border-b border-gray-800 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#39FF14]/20 border border-[#39FF14]/40 rounded-xl flex items-center justify-center">
              <Ruler className="w-5 h-5 text-[#39FF14]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">RCRS Roof Measure</h1>
              <p className="text-xs text-gray-400">AI-Powered Satellite Measurement</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {STEP_LABELS.map((label, i) => {
              const stepNum = (i + 1) as Step;
              const isCurrent = step === stepNum;
              const isPast = step > stepNum;
              return (
                <div key={label} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    isCurrent ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40' :
                    isPast ? 'bg-[#39FF14]/10 text-[#39FF14]/70' :
                    'bg-gray-800 text-gray-500'
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPast ? 'bg-[#39FF14] text-black' : isCurrent ? 'bg-[#39FF14]/30 text-[#39FF14]' : 'bg-gray-700'
                    }`}>
                      {isPast ? '✓' : stepNum}
                    </span>
                    <span className="hidden lg:inline">{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-600 mx-0.5" />}
                </div>
              );
            })}
          </div>
        </div>
        {/* Mobile step indicator */}
        <div className="md:hidden mt-2">
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#39FF14] rounded-full transition-all duration-500"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Step {step} of 6: {STEP_LABELS[step - 1]}</p>
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

      {/* ═══════════════════ STEP 1: ENTER ADDRESS ═══════════════════ */}
      {step === 1 && !photoMode && (
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto bg-[#0066CC]/20 border border-[#0066CC]/30 rounded-2xl flex items-center justify-center mb-4">
              <Home className="w-10 h-10 text-[#0066CC]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Measure Any Roof</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Enter a property address and we&apos;ll use satellite imagery and AI to generate
              professional-grade roof measurements.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={address}
                onChange={e => onAddressChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && goToStep2()}
                placeholder="123 Main St, Decatur, AL 35601"
                className="w-full pl-12 pr-12 py-4 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50 text-base"
                autoFocus
              />
              {loadingSuggestions && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#39FF14] animate-spin" />
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-700/50 shadow-xl">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectAddress(s)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-800 transition flex items-start gap-3"
                  >
                    <MapPin className="w-4 h-4 text-[#39FF14] mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-200">{s}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={goToStep2}
              disabled={!address.trim()}
              className="w-full py-4 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition text-lg"
            >
              Next: Select Structure on Map <ChevronRight className="w-5 h-5" />
            </button>

            <div className="relative flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <button
              onClick={() => setPhotoMode(true)}
              className="w-full py-4 bg-[#0066CC] text-white font-semibold rounded-xl hover:bg-[#0066CC]/90 flex items-center justify-center gap-2 transition text-lg border border-[#0066CC]"
            >
              <Camera className="w-5 h-5" /> Upload Photos / Drone Video Instead
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-10">
            <FeatureCard icon={Layers} title="Multi-Source" desc="Google, Esri aerial imagery" />
            <FeatureCard icon={BarChart3} title="AI Consensus" desc="3-5 independent AI passes" />
            <FeatureCard icon={Shield} title="Verified" desc="Outlier detection & validation" />
          </div>
        </div>
      )}

      {/* ═══════════════════ PHOTO UPLOAD MODE ═══════════════════ */}
      {step === 1 && photoMode && (
        <div className="max-w-2xl mx-auto px-4 py-12">
          <button onClick={() => setPhotoMode(false)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition">
            <ChevronLeft className="w-4 h-4" /> Back to Address Entry
          </button>

          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto bg-[#0066CC]/20 border border-[#0066CC]/30 rounded-2xl flex items-center justify-center mb-4">
              <Camera className="w-10 h-10 text-[#0066CC]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Photo-Based Measurement</h2>
            <p className="text-gray-400">Upload photos or drone footage for AI analysis. Include the address for the report.</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Property address for the report"
                className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 border-2 border-dashed border-gray-600 rounded-xl hover:border-[#39FF14]/50 transition flex flex-col items-center gap-2 text-gray-400 hover:text-[#39FF14]"
            >
              <Upload className="w-8 h-8" />
              <span className="font-medium">Click to upload photos or video</span>
              <span className="text-xs text-gray-500">JPG, PNG, or video files</span>
            </button>

            {uploadedPhotos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300">{uploadedPhotos.length} file(s) uploaded</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {uploadedPhotos.map((photo, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                      <div className="relative h-32">
                        {photo.file.type.startsWith('video') ? (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <FileText className="w-8 h-8 text-gray-500" />
                          </div>
                        ) : (
                          <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                        )}
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-900/80 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="p-2">
                        <select
                          value={photo.label}
                          onChange={e => updatePhotoLabel(i, e.target.value)}
                          className="w-full text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300"
                        >
                          {PHOTO_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={runMeasurement}
              disabled={!address.trim() || uploadedPhotos.length === 0}
              className="w-full py-4 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition text-lg"
            >
              <Ruler className="w-5 h-5" /> Submit for Measurement
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP 2: SELECT STRUCTURE ON MAP ═══════════════════ */}
      {step === 2 && (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-57px)]">
          <div className="w-full lg:w-80 bg-gray-950 border-b lg:border-b-0 lg:border-r border-gray-800 p-4 overflow-y-auto flex-shrink-0">
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Property</p>
              <p className="text-sm text-gray-200 truncate">{formattedAddress || address}</p>
            </div>

            <div className="border-t border-gray-800 pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">Structures</h3>
                <span className="text-xs text-gray-500">{structures.length} selected</span>
              </div>

              {structures.length === 0 && (
                <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-400">
                    Click the map to draw polygons around structures, or use Quick Select below.
                  </p>
                </div>
              )}

              <div className="space-y-2 mb-3">
                {structures.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                      activeStructureId === s.id
                        ? 'bg-[#39FF14]/10 border border-[#39FF14]/40'
                        : 'bg-gray-900 border border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => setActiveStructureId(s.id)}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: POLYGON_COLORS[s.type] }} />
                    <span className="text-sm flex-1 truncate">{s.name}</span>
                    <span className="text-[10px] text-gray-500 uppercase">{s.type}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeStructure(s.id); }}
                      className="text-gray-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {isDrawing ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#39FF14] flex items-center gap-1">
                    <CircleDot className="w-3 h-3" /> Click map to place points ({drawPoints.length} placed)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={finishDrawing}
                      disabled={drawPoints.length < 3}
                      className="flex-1 py-2 px-3 bg-[#39FF14] text-black text-sm font-semibold rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-40 transition"
                    >
                      Mark as {STRUCTURE_TYPES.find(t => t.value === drawingType)?.label || 'Structure'}
                    </button>
                    <button
                      onClick={cancelDrawing}
                      className="py-2 px-3 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Draw Structure</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STRUCTURE_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => startDrawing(t.value as Structure['type'])}
                        className="flex items-center gap-1.5 py-1.5 px-2 bg-gray-900 border border-gray-700 rounded-lg hover:border-[#39FF14]/40 transition text-xs text-gray-300"
                      >
                        <t.icon className="w-3 h-3" style={{ color: POLYGON_COLORS[t.value] }} />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-gray-800">
                    <button
                      onClick={autoSelectMainStructure}
                      className="w-full py-2 px-3 bg-gray-900 border border-dashed border-gray-600 rounded-lg hover:border-[#39FF14]/50 transition text-xs text-gray-400 flex items-center justify-center gap-1.5"
                    >
                      <Maximize2 className="w-3 h-3" /> Quick Select Main Structure
                    </button>
                  </div>

                  <div className="pt-2 border-t border-gray-800">
                    <button
                      onClick={() => startDrawing('garage')}
                      className="w-full py-2 px-3 bg-gray-900 border border-dashed border-yellow-600/40 rounded-lg hover:border-yellow-500/60 transition text-xs text-gray-400 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" /> Add Detached Structure
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-800">
              <button
                onClick={goToStep3}
                className="w-full py-3 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 transition flex items-center justify-center gap-2"
              >
                Next: Verify Imagery <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full py-2 text-gray-400 text-sm hover:text-gray-300 transition flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Change Address
              </button>
            </div>
          </div>

          <div className="flex-1 relative">
            <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />
            {isDrawing && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#39FF14]/90 text-black text-sm font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-10">
                <CircleDot className="w-4 h-4 animate-pulse" />
                Click to place points. {drawPoints.length >= 3 ? 'Click "Mark as..." when done.' : `Need ${3 - drawPoints.length} more.`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP 3: VERIFY IMAGERY ═══════════════════ */}
      {step === 3 && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Verify Satellite &amp; Street View Imagery</h2>
              <p className="text-sm text-gray-400 mt-1">
                Review the images below. Deselect any that don&apos;t show your building correctly.
              </p>
            </div>
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition">
              <ChevronLeft className="w-4 h-4" /> Back to Map
            </button>
          </div>

          {loadingPreview ? (
            <div className="flex flex-col items-center py-20">
              <Loader2 className="w-10 h-10 text-[#39FF14] animate-spin mb-4" />
              <p className="text-gray-400">Loading preview imagery...</p>
            </div>
          ) : (
            <>
              {/* Satellite Images */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Satellite / Aerial Images</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {previewImages.filter(i => i.source !== 'Street View').map(img => (
                    <div key={img.id} className="relative group">
                      <div
                        className={`relative rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                          img.selected ? 'border-[#39FF14]' : 'border-gray-700 opacity-50'
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
                            <div className="w-6 h-6 bg-black/60 border border-gray-500 rounded-full" />
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEnlargedImage(img.src); }}
                          className="absolute bottom-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-center">{img.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Street View Images */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Street View Images</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {previewImages.filter(i => i.source === 'Street View').map(img => (
                    <div key={img.id} className="relative group">
                      <div
                        className={`relative rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                          img.selected ? 'border-[#39FF14]' : 'border-gray-700 opacity-50'
                        }`}
                        onClick={() => toggleImageSelection(img.id)}
                      >
                        <img src={img.src} alt={img.label} className="w-full aspect-[4/3] object-cover" />
                        <div className="absolute top-2 right-2">
                          {img.selected ? (
                            <div className="w-6 h-6 bg-[#39FF14] rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-black" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-black/60 border border-gray-500 rounded-full" />
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEnlargedImage(img.src); }}
                          className="absolute bottom-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-center">{img.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low imagery warning */}
              {selectedImageCount < 3 && (
                <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-200 font-medium">Limited satellite coverage</p>
                    <p className="text-xs text-amber-300/70 mt-1">Consider uploading photos for better accuracy.</p>
                  </div>
                </div>
              )}

              {/* Upload additional photos */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handlePhotoUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border border-dashed border-gray-600 rounded-lg hover:border-[#0066CC] transition flex items-center justify-center gap-2 text-gray-400 hover:text-[#0066CC]"
                >
                  <Upload className="w-4 h-4" /> Upload Additional Photos / Drone Footage
                </button>
                {uploadedPhotos.length > 0 && (
                  <p className="text-xs text-[#39FF14] mt-2 text-center">{uploadedPhotos.length} additional file(s) attached</p>
                )}
              </div>

              {/* Submit button */}
              <div className="flex gap-3">
                <button
                  onClick={runMeasurement}
                  disabled={selectedImageCount < 2}
                  className="flex-1 py-4 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition text-lg"
                >
                  <Ruler className="w-5 h-5" /> Submit for Measurement
                </button>
              </div>
              {selectedImageCount < 2 && (
                <p className="text-xs text-gray-500 text-center mt-2">Select at least 2 images to continue</p>
              )}
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

      {/* ═══════════════════ STEP 4: MEASURING ═══════════════════ */}
      {step === 4 && (
        <div className="max-w-lg mx-auto px-4 py-20">
          <div className="flex flex-col items-center space-y-8">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 rounded-2xl bg-[#39FF14]/10 border-2 border-[#39FF14]/30" />
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="w-full h-1 bg-[#39FF14]/40 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
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
              <p className="text-gray-500 text-xs">
                Elapsed: {formatTime(elapsedTime)}
              </p>
            </div>

            <div className="w-full max-w-xs">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0066CC] to-[#39FF14] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">Processing</span>
                <span className="text-xs text-gray-400">{progressPercent}%</span>
              </div>
            </div>

            <p className="text-gray-500 text-xs text-center">
              This typically takes 1-3 minutes. Longer for complex roofs.
            </p>

            {elapsedTime > 180 && (
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-2 text-xs text-amber-300">
                Still working — complex roof detected, running additional analysis passes
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP 5: RESULTS & MANUAL OVERRIDE ═══════════════════ */}
      {step === 5 && activeReport && (
        <ResultsView
          structures={structures}
          selectedId={selectedStructureReport}
          onSelectStructure={setSelectedStructureReport}
          onNext={() => setStep(6)}
          onBackToMap={() => setStep(2)}
          address={formattedAddress || address}
          manualOverrides={manualOverrides}
          setOverride={setOverride}
          getOverride={getOverride}
          getFinalValue={getFinalValue}
          componentOverrides={componentOverrides}
          getComponentOverride={getComponentOverride}
          setComponentOverride={setComponentOverride}
          uploadedPhotos={uploadedPhotos}
          fileInputRef={fileInputRef}
          handlePhotoUpload={handlePhotoUpload}
        />
      )}

      {/* ═══════════════════ STEP 6: EXPORT & PRINT ═══════════════════ */}
      {step === 6 && activeReport && (
        <ExportView
          structures={structures}
          selectedId={selectedStructureReport}
          address={formattedAddress || address}
          manualOverrides={manualOverrides}
          getFinalValue={getFinalValue}
          onBack={() => setStep(5)}
          onNewMeasurement={reset}
          printMode={printMode}
          setPrintMode={setPrintMode}
        />
      )}

      {/* Global styles */}
      <style jsx global>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(128px); }
        }
        @media print {
          header, .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 5: RESULTS VIEW
// ══════════════════════════════════════════════════════════════════════════════

function ResultsView({
  structures, selectedId, onSelectStructure, onNext, onBackToMap, address,
  manualOverrides, setOverride, getOverride, getFinalValue,
  componentOverrides, getComponentOverride, setComponentOverride,
  uploadedPhotos, fileInputRef, handlePhotoUpload,
}: {
  structures: Structure[];
  selectedId: string | null;
  onSelectStructure: (id: string) => void;
  onNext: () => void;
  onBackToMap: () => void;
  address: string;
  manualOverrides: Record<string, ManualOverride>;
  setOverride: (structId: string, key: string, val: string) => void;
  getOverride: (structId: string, key: string) => string;
  getFinalValue: (structId: string, key: string, aiValue: number) => { value: number; fieldVerified: boolean };
  componentOverrides: Record<string, ComponentOverride>;
  getComponentOverride: (structId: string, key: string) => string;
  setComponentOverride: (structId: string, key: string, val: string) => void;
  uploadedPhotos: UploadedPhoto[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true, measurements: true, components: true, confidence: true, storm: false,
  });

  const struct = structures.find(s => s.id === selectedId) || structures[0];
  const report = struct?.result;
  const structId = struct?.id || '';

  if (!report) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">Measurement Failed</h3>
        <p className="text-gray-400 mb-6">{struct?.error || 'No data returned from analysis.'}</p>
        <button onClick={onBackToMap} className="px-6 py-3 bg-[#39FF14] text-black rounded-xl font-bold hover:bg-[#39FF14]/90 transition">
          Try Again
        </button>
      </div>
    );
  }

  const m = report.measurements;
  const totalArea = report.solarData?.totalRoofAreaSqFt || 0;
  const squares = Math.round(totalArea / 100 * 10) / 10;
  const confidence = report.overallConfidence;

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const measurementRows = [
    { key: 'ridge', label: 'Ridge', ai: m?.ridges?.totalFt || 0, confidence: m?.ridges?.confidence },
    { key: 'rake', label: 'Rake', ai: m?.rakes?.totalFt || 0, confidence: m?.rakes?.confidence },
    { key: 'valley', label: 'Valley', ai: m?.valleys?.totalFt || 0, confidence: m?.valleys?.confidence },
    { key: 'eave', label: 'Eave', ai: m?.eaves?.totalFt || 0, confidence: m?.eaves?.confidence },
    { key: 'hip', label: 'Hip', ai: m?.hips?.totalFt || 0, confidence: m?.hips?.confidence },
    { key: 'perimeter', label: 'Perimeter', ai: m?.perimeterFt || 0 },
  ];

  const componentSections = [
    { key: 'vents', label: 'Vents', items: report.components?.vents },
    { key: 'pipes', label: 'Pipes', items: report.components?.pipes },
    { key: 'chimneys', label: 'Chimneys', items: report.components?.chimneys },
    { key: 'skylights', label: 'Skylights', items: report.components?.skylights },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-20">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-[#0066CC]/20 to-gray-950 border border-[#0066CC]/30 rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-[#39FF14]/20 rounded-lg flex items-center justify-center">
                <Ruler className="w-4 h-4 text-[#39FF14]" />
              </div>
              <h2 className="text-xl font-bold">Roof Measurement Report</h2>
            </div>
            <p className="text-gray-300 flex items-center gap-1.5 text-sm">
              <MapPin className="w-3.5 h-3.5 text-[#39FF14]" /> {report.address || address}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>Generated {new Date(report.generatedAt).toLocaleDateString()}</span>
              <span className="text-gray-600">|</span>
              <span>Imagery: {report.imageryDate}</span>
              <span className="text-gray-600">|</span>
              <span>{report.pipeline?.totalAiPasses || 0} AI passes</span>
            </div>
          </div>
          <div className="flex items-start gap-2 no-print">
            <button onClick={onBackToMap} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition flex items-center gap-1.5 text-xs">
              <Eye className="w-3.5 h-3.5" /> Map
            </button>
            <button onClick={onNext} className="px-4 py-2 bg-[#39FF14] text-black rounded-lg font-bold hover:bg-[#39FF14]/90 transition flex items-center gap-1.5 text-sm">
              Export &amp; Print <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {structures.length > 1 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#0066CC]/20 overflow-x-auto no-print">
            {structures.map(s => (
              <button
                key={s.id}
                onClick={() => onSelectStructure(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                  s.id === (selectedId || structures[0]?.id)
                    ? 'bg-[#39FF14] text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: POLYGON_COLORS[s.type] }} />
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LOW CONFIDENCE BANNER */}
      {confidence === 'LOW' && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-300">On-site verification recommended</p>
            <p className="text-xs text-red-300/70 mt-1">Significant variance between AI passes. Field measurements should be used where available.</p>
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handlePhotoUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-red-800/50 border border-red-700/50 text-red-200 text-xs rounded-lg hover:bg-red-800/70 transition shrink-0"
          >
            <Upload className="w-3 h-3 inline mr-1" /> Upload Photos
          </button>
        </div>
      )}

      {/* CONFIDENCE SECTION */}
      <CollapsibleSection
        title="Confidence &amp; Quality"
        icon={Shield}
        expanded={expandedSections.confidence}
        onToggle={() => toggleSection('confidence')}
      >
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
              <p className="text-xs text-gray-400">
                {report.pipeline?.finalVariance !== undefined &&
                  `${(report.pipeline.finalVariance * 100).toFixed(1)}% max variance across ${report.pipeline.totalAiPasses} AI passes`}
              </p>
            </div>
          </div>

          {report.pipeline?.allProviderResults?.length > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase">
                    <th className="pb-1 pr-3 text-left">Pass</th>
                    <th className="pb-1 pr-3 text-right">Ridge</th>
                    <th className="pb-1 pr-3 text-right">Rake</th>
                    <th className="pb-1 text-right">Eave</th>
                  </tr>
                </thead>
                <tbody>
                  {report.pipeline.allProviderResults.map((r, i) => (
                    <tr key={i} className="text-gray-300 border-t border-gray-800/50">
                      <td className="py-1 pr-3"><span className="bg-gray-800 px-1.5 py-0.5 rounded">{r.name}</span></td>
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
            <div className="space-y-1 pt-2 border-t border-gray-700/50">
              {report.qualityNotes.map((note, i) => (
                <p key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                  <Info className="w-3 h-3 mt-0.5 shrink-0 text-gray-500" />
                  {note}
                </p>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* OVERVIEW: KEY METRICS */}
      <CollapsibleSection
        title="Property Overview"
        icon={Home}
        expanded={expandedSections.overview}
        onToggle={() => toggleSection('overview')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {report.images?.satellite ? (
              <img src={report.images.satellite} alt="Satellite" className="w-full h-64 lg:h-72 object-cover" />
            ) : (
              <div className="w-full h-64 lg:h-72 bg-gray-800 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Satellite image unavailable</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Total Roof Area" value={`${totalArea.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} unit="sq ft" icon={Home} highlight />
            <MetricCard label="Roofing Squares" value={String(squares)} unit="squares" icon={Hash} highlight />
            <MetricCard label="Primary Pitch" value={m?.pitches?.primary || 'N/A'} icon={Triangle} />
            <MetricCard label="Roof Style" value={capitalize(m?.roofStyle || 'N/A')} icon={Building} />
            <MetricCard label="Segments" value={String(report.solarData?.segmentCount || 0)} icon={Layers} />
            <MetricCard label="Perimeter" value={`${m?.perimeterFt || 0}`} unit="ft" icon={Square} />
          </div>
        </div>
      </CollapsibleSection>

      {/* DETAILED MEASUREMENTS WITH MANUAL OVERRIDE */}
      <CollapsibleSection
        title="Detailed Measurements"
        icon={Ruler}
        expanded={expandedSections.measurements}
        onToggle={() => toggleSection('measurements')}
      >
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase bg-gray-900/80">
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">AI Measured</th>
                  <th className="px-4 py-3 text-center">Manual Override</th>
                  <th className="px-4 py-3 text-right">Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {measurementRows.map(row => {
                  const final = getFinalValue(structId, row.key, row.ai);
                  return (
                    <tr key={row.key} className="text-gray-200 hover:bg-gray-800/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EDGE_COLORS[row.key] || '#666' }} />
                          {row.label}
                          {row.confidence && <ConfidenceBadge level={row.confidence} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-400">{row.ai} ft</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="—"
                          value={getOverride(structId, row.key)}
                          onChange={e => setOverride(structId, row.key, e.target.value)}
                          className="w-24 mx-auto block text-center bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white placeholder-gray-600 focus:border-[#39FF14]/50 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono font-bold">{final.value} ft</span>
                          {final.fieldVerified && (
                            <span className="text-[10px] bg-[#39FF14]/20 text-[#39FF14] px-1.5 py-0.5 rounded font-medium">
                              Field Verified
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>

      {/* COMPONENTS BREAKDOWN */}
      <CollapsibleSection
        title="Components &amp; Penetrations"
        icon={Layers}
        expanded={expandedSections.components}
        onToggle={() => toggleSection('components')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {componentSections.map(section => (
            <div key={section.key} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-200 mb-3">{section.label}</h4>
              {section.items?.length > 0 ? (
                <div className="space-y-2">
                  {section.items.map((item: RoofComponent, i: number) => {
                    const compKey = `${section.key}_${i}`;
                    const overrideVal = getComponentOverride(structId, compKey);
                    return (
                      <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-300">
                          {formatComponentLabel(section.key, item)}
                        </span>
                        <div className="flex items-center gap-2">
                          <ConfidenceBadge level={item.confidence} />
                          <input
                            type="text"
                            placeholder="override"
                            value={overrideVal}
                            onChange={e => setComponentOverride(structId, compKey, e.target.value)}
                            className="w-16 text-center bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-white placeholder-gray-600 focus:border-[#39FF14]/50 focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500">None detected</p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* STORM / HAIL */}
      <CollapsibleSection
        title="Storm &amp; Hail Assessment"
        icon={CloudLightning}
        expanded={expandedSections.storm}
        onToggle={() => toggleSection('storm')}
      >
        {(() => {
          const stormNotes = report.qualityNotes?.filter(n =>
            n.toLowerCase().includes('storm') || n.toLowerCase().includes('hail') || n.toLowerCase().includes('weather')
          ) || [];
          return stormNotes.length > 0 ? (
            <div className="space-y-2">
              {stormNotes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 bg-gray-900 border border-gray-800 rounded-lg p-3">
                  <CloudLightning className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-300">{note}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <Droplets className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No storm/hail data available for this measurement.</p>
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* Upload photos to improve accuracy */}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between no-print">
        <div>
          <p className="text-sm font-medium text-gray-200">Upload Photos to Improve Accuracy</p>
          <p className="text-xs text-gray-500">Add field photos or drone footage for enhanced AI analysis</p>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handlePhotoUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-[#0066CC] text-white text-sm rounded-lg hover:bg-[#0066CC]/90 transition flex items-center gap-1.5"
        >
          <Camera className="w-4 h-4" /> Upload Photos
        </button>
      </div>

      {/* Go to Export */}
      <div className="mt-6 no-print">
        <button
          onClick={onNext}
          className="w-full py-4 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 flex items-center justify-center gap-2 transition text-lg"
        >
          Next: Export &amp; Print <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 6: EXPORT VIEW
// ══════════════════════════════════════════════════════════════════════════════

function ExportView({
  structures, selectedId, address, manualOverrides, getFinalValue,
  onBack, onNewMeasurement, printMode, setPrintMode,
}: {
  structures: Structure[];
  selectedId: string | null;
  address: string;
  manualOverrides: Record<string, ManualOverride>;
  getFinalValue: (structId: string, key: string, aiValue: number) => { value: number; fieldVerified: boolean };
  onBack: () => void;
  onNewMeasurement: () => void;
  printMode: 'full' | 'summary' | 'crew' | null;
  setPrintMode: (m: 'full' | 'summary' | 'crew' | null) => void;
}) {
  const [copied, setCopied] = useState(false);

  const struct = structures.find(s => s.id === selectedId) || structures[0];
  const report = struct?.result;
  const structId = struct?.id || '';

  if (!report) return null;

  const m = report.measurements;
  const totalArea = report.solarData?.totalRoofAreaSqFt || 0;
  const squares = Math.round(totalArea / 100 * 10) / 10;

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = (mode: 'full' | 'summary' | 'crew') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(null), 500);
    }, 100);
  };

  const measurementRows = [
    { key: 'ridge', label: 'Ridge', ai: m?.ridges?.totalFt || 0 },
    { key: 'rake', label: 'Rake', ai: m?.rakes?.totalFt || 0 },
    { key: 'valley', label: 'Valley', ai: m?.valleys?.totalFt || 0 },
    { key: 'eave', label: 'Eave', ai: m?.eaves?.totalFt || 0 },
    { key: 'hip', label: 'Hip', ai: m?.hips?.totalFt || 0 },
    { key: 'perimeter', label: 'Perimeter', ai: m?.perimeterFt || 0 },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-20">
      <div className="flex items-center justify-between mb-6 no-print">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition">
          <ChevronLeft className="w-4 h-4" /> Back to Results
        </button>
        <h2 className="text-xl font-bold">Export &amp; Print</h2>
        <div />
      </div>

      {/* Export buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 no-print">
        <button
          onClick={() => handlePrint('full')}
          className="p-4 bg-gray-900 border border-gray-700 rounded-xl hover:border-[#39FF14]/50 transition text-left"
        >
          <Printer className="w-6 h-6 text-[#39FF14] mb-2" />
          <h3 className="text-sm font-semibold text-white">Print Full Report</h3>
          <p className="text-xs text-gray-400 mt-1">Complete report with all measurements, images, and analysis details</p>
        </button>
        <button
          onClick={() => handlePrint('summary')}
          className="p-4 bg-gray-900 border border-gray-700 rounded-xl hover:border-[#0066CC]/50 transition text-left"
        >
          <FileText className="w-6 h-6 text-[#0066CC] mb-2" />
          <h3 className="text-sm font-semibold text-white">Print Summary Only</h3>
          <p className="text-xs text-gray-400 mt-1">Key measurements in large font, no charts or images</p>
        </button>
        <button
          onClick={() => handlePrint('crew')}
          className="p-4 bg-gray-900 border border-gray-700 rounded-xl hover:border-amber-500/50 transition text-left"
        >
          <Users className="w-6 h-6 text-amber-400 mb-2" />
          <h3 className="text-sm font-semibold text-white">Print for Field Crew</h3>
          <p className="text-xs text-gray-400 mt-1">Measurements + component list, lightweight — no images</p>
        </button>
      </div>

      {/* Share link */}
      <div className="flex gap-3 mb-8 no-print">
        <button
          onClick={handleCopyLink}
          className="flex-1 py-3 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition flex items-center justify-center gap-2 text-sm"
        >
          {copied ? <CheckCircle className="w-4 h-4 text-[#39FF14]" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Share Link'}
        </button>
        <button
          onClick={onNewMeasurement}
          className="flex-1 py-3 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 transition flex items-center justify-center gap-2 text-sm"
        >
          <RotateCcw className="w-4 h-4" /> Measure Another Property
        </button>
      </div>

      {/* ── Printable Report ────────────────────────────────────────────────── */}
      <div className="bg-white text-black rounded-2xl p-8 print:rounded-none print:p-4">
        {/* RCRS Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">RIVER CITY ROOFING &amp; SOLAR</h1>
            <p className="text-sm text-gray-600">AI-Powered Roof Measurement Report</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{new Date(report.generatedAt).toLocaleDateString()}</p>
            <p>{report.pipeline?.totalAiPasses || 0} AI Passes</p>
          </div>
        </div>

        {/* Property Info */}
        <div className="mb-6">
          <p className="text-lg font-bold">{report.address || address}</p>
          <p className="text-sm text-gray-500">Imagery Date: {report.imageryDate} | Confidence: {report.overallConfidence}</p>
        </div>

        {/* Key Metrics (always shown) */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border-2 border-black rounded-xl p-4 text-center">
            <p className="text-3xl font-black">{totalArea.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-gray-600 uppercase tracking-wider mt-1">Total Sq Ft</p>
          </div>
          <div className="border-2 border-black rounded-xl p-4 text-center">
            <p className="text-3xl font-black">{squares}</p>
            <p className="text-xs text-gray-600 uppercase tracking-wider mt-1">Squares</p>
          </div>
          <div className="border-2 border-black rounded-xl p-4 text-center">
            <p className="text-3xl font-black">{m?.pitches?.primary || 'N/A'}</p>
            <p className="text-xs text-gray-600 uppercase tracking-wider mt-1">Primary Pitch</p>
          </div>
          <div className="border-2 border-black rounded-xl p-4 text-center">
            <p className="text-3xl font-black">{capitalize(m?.roofStyle || 'N/A')}</p>
            <p className="text-xs text-gray-600 uppercase tracking-wider mt-1">Roof Style</p>
          </div>
        </div>

        {/* Satellite image (full report only) */}
        {(!printMode || printMode === 'full') && report.images?.satellite && (
          <div className="mb-6">
            <img src={report.images.satellite} alt="Satellite" className="w-full h-64 object-cover rounded-xl border border-gray-300" />
          </div>
        )}

        {/* Measurements table (always shown) */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3 border-b border-gray-300 pb-1">Linear Measurements</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase">
                <th className="py-2 text-left">Type</th>
                <th className="py-2 text-right">AI Measured</th>
                <th className="py-2 text-right">Final</th>
                <th className="py-2 text-right">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {measurementRows.map(row => {
                const final = getFinalValue(structId, row.key, row.ai);
                return (
                  <tr key={row.key}>
                    <td className="py-2 font-medium">{row.label}</td>
                    <td className="py-2 text-right font-mono text-gray-500">{row.ai} ft</td>
                    <td className="py-2 text-right font-mono font-bold">{final.value} ft</td>
                    <td className="py-2 text-right text-xs">
                      {final.fieldVerified ? (
                        <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-medium">Field Verified</span>
                      ) : (
                        <span className="text-gray-400">AI</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Components (full + crew) */}
        {(!printMode || printMode === 'full' || printMode === 'crew') && (
          <div className="mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-3 border-b border-gray-300 pb-1">Components &amp; Penetrations</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Vents', items: report.components?.vents },
                { label: 'Pipes', items: report.components?.pipes },
                { label: 'Chimneys', items: report.components?.chimneys },
                { label: 'Skylights', items: report.components?.skylights },
              ].map(section => (
                <div key={section.label}>
                  <p className="font-semibold text-xs uppercase text-gray-500 mb-1">{section.label}</p>
                  {section.items?.length ? section.items.map((item: RoofComponent, i: number) => (
                    <p key={i} className="text-gray-700">{formatComponentLabel(section.label.toLowerCase(), item)}</p>
                  )) : <p className="text-gray-400 italic">None detected</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t-2 border-black pt-3 mt-6 flex items-center justify-between text-xs text-gray-500">
          <p>River City Roofing &amp; Solar — Decatur, AL</p>
          <p>Generated by RCRS AI Measurement System</p>
        </div>
      </div>
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
        className="w-full flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-xl hover:bg-gray-900 transition"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#39FF14]" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 text-center">
      <Icon className="w-5 h-5 text-[#39FF14] mx-auto mb-1.5" />
      <p className="text-xs font-medium text-gray-200">{title}</p>
      <p className="text-[10px] text-gray-500">{desc}</p>
    </div>
  );
}

function MetricCard({ label, value, unit, icon: Icon, highlight }: {
  label: string; value: string; unit?: string; icon: any; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${
      highlight ? 'bg-[#0066CC]/10 border-[#0066CC]/30' : 'bg-gray-800/50 border-gray-700/50'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-[#39FF14]" />
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`font-bold ${highlight ? 'text-xl text-white' : 'text-lg text-gray-200'}`}>{value}</span>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    HIGH: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
    MEDIUM: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
    LOW: 'bg-red-900/50 text-red-300 border-red-700/50',
    'N/A': 'bg-gray-800 text-gray-400 border-gray-700',
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
