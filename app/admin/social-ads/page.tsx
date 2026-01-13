'use client';

import { useState } from 'react';
import { socialAds, brandGuidelines, SocialAd } from '@/lib/socialAds';
import {
  Facebook,
  Instagram,
  Copy,
  Check,
  Eye,
  Image as ImageIcon,
  Video,
  Layers,
  Hash,
  Target,
  Megaphone,
} from 'lucide-react';

export default function SocialAdsPage() {
  const [selectedAd, setSelectedAd] = useState<SocialAd | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <Facebook className="w-5 h-5 text-blue-600" />;
      case 'instagram':
        return <Instagram className="w-5 h-5 text-pink-600" />;
      default:
        return (
          <div className="flex gap-1">
            <Facebook className="w-4 h-4 text-blue-600" />
            <Instagram className="w-4 h-4 text-pink-600" />
          </div>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'carousel':
        return <Layers className="w-4 h-4" />;
      default:
        return <ImageIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Media Ads</h1>
          <p className="text-gray-500 mt-1">
            Ready-to-use ad content for Facebook and Instagram campaigns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-black rounded-lg">
            <div className="w-4 h-4 rounded-full bg-black border-2 border-gray-400"></div>
            <span className="text-white text-sm">Black</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-brand-green rounded-lg">
            <div className="w-4 h-4 rounded-full bg-brand-green"></div>
            <span className="text-black text-sm font-medium">Lime Green</span>
          </div>
        </div>
      </div>

      {/* Brand Info Card */}
      <div className="bg-gradient-to-r from-black to-neutral-800 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <Megaphone className="w-10 h-10 text-brand-green" />
          <div>
            <h2 className="text-xl font-bold">{brandGuidelines.companyInfo.name}</h2>
            <p className="text-gray-300">{brandGuidelines.companyInfo.tagline}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-brand-green font-bold text-lg">{brandGuidelines.companyInfo.phone}</p>
            <p className="text-gray-400">{brandGuidelines.companyInfo.location}</p>
          </div>
        </div>
      </div>

      {/* Ads Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {socialAds.map((ad) => (
          <div
            key={ad.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Ad Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getPlatformIcon(ad.platform)}
                <div>
                  <h3 className="font-bold text-gray-900">Ad #{ad.id}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {getTypeIcon(ad.type)}
                    <span className="capitalize">{ad.type}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAd(selectedAd?.id === ad.id ? null : ad)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Eye className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Ad Content Preview */}
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Headline</p>
                <p className="font-bold text-gray-900">{ad.headline}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Primary Text</p>
                <p className="text-gray-600 text-sm line-clamp-3">{ad.primaryText}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Call to Action</p>
                <p className="text-brand-green font-medium">{ad.callToAction}</p>
              </div>
            </div>

            {/* Ad Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
              {ad.hashtags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-brand-green/10 text-brand-green text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
              {ad.hashtags.length > 4 && (
                <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                  +{ad.hashtags.length - 4} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Ad Detail Modal */}
      {selectedAd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                {getPlatformIcon(selectedAd.platform)}
                <h2 className="text-xl font-bold">Ad #{selectedAd.id} Details</h2>
              </div>
              <button
                onClick={() => setSelectedAd(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Headline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-500 uppercase">Headline</label>
                  <button
                    onClick={() => copyToClipboard(selectedAd.headline, 'headline')}
                    className="flex items-center gap-1 text-sm text-brand-green hover:text-brand-green/80"
                  >
                    {copiedField === 'headline' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedField === 'headline' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-lg font-bold text-gray-900 bg-gray-50 p-3 rounded-lg">
                  {selectedAd.headline}
                </p>
              </div>

              {/* Primary Text */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-500 uppercase">Primary Text</label>
                  <button
                    onClick={() => copyToClipboard(selectedAd.primaryText, 'primaryText')}
                    className="flex items-center gap-1 text-sm text-brand-green hover:text-brand-green/80"
                  >
                    {copiedField === 'primaryText' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedField === 'primaryText' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg whitespace-pre-wrap text-gray-700">
                  {selectedAd.primaryText}
                </div>
              </div>

              {/* CTA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 uppercase block mb-2">
                    Call to Action
                  </label>
                  <p className="bg-brand-green/10 text-brand-green font-medium p-3 rounded-lg">
                    {selectedAd.callToAction}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 uppercase block mb-2">
                    CTA Button
                  </label>
                  <p className="bg-black text-white font-medium p-3 rounded-lg text-center">
                    {selectedAd.ctaButton}
                  </p>
                </div>
              </div>

              {/* Hashtags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-500 uppercase flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Hashtags
                  </label>
                  <button
                    onClick={() => copyToClipboard(selectedAd.hashtags.join(' '), 'hashtags')}
                    className="flex items-center gap-1 text-sm text-brand-green hover:text-brand-green/80"
                  >
                    {copiedField === 'hashtags' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedField === 'hashtags' ? 'Copied!' : 'Copy All'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedAd.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-brand-green/10 text-brand-green rounded-full cursor-pointer hover:bg-brand-green/20"
                      onClick={() => copyToClipboard(tag, tag)}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label className="text-sm font-medium text-gray-500 uppercase flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4" />
                  Target Audience
                </label>
                <p className="bg-blue-50 text-blue-700 p-3 rounded-lg">
                  {selectedAd.targetAudience}
                </p>
              </div>

              {/* Image Suggestion */}
              <div>
                <label className="text-sm font-medium text-gray-500 uppercase flex items-center gap-2 mb-2">
                  <ImageIcon className="w-4 h-4" />
                  Suggested Image/Visual
                </label>
                <p className="bg-purple-50 text-purple-700 p-3 rounded-lg">
                  {selectedAd.suggestedImage}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  const fullContent = `HEADLINE:\n${selectedAd.headline}\n\nPRIMARY TEXT:\n${selectedAd.primaryText}\n\nCALL TO ACTION:\n${selectedAd.callToAction}\n\nHASHTAGS:\n${selectedAd.hashtags.join(' ')}`;
                  copyToClipboard(fullContent, 'full');
                }}
                className="w-full py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-colors flex items-center justify-center gap-2"
              >
                {copiedField === 'full' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copiedField === 'full' ? 'Copied All Content!' : 'Copy All Ad Content'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
