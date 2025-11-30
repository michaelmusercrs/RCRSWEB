'use client';

import { Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { teamMembers } from '@/lib/teamData';
import { services, serviceAreas } from '@/lib/servicesData';
import { useRouter } from 'next/navigation';

// Get all team members for dropdown
const allTeamMembers = teamMembers.filter(m => m.category !== 'In Loving Memory');

// Get all services for dropdown
const allServices = services;

// Get all active service areas for dropdown
const activeServiceAreas = serviceAreas.filter(a => a.status === 'Active');

interface ContactFormProps {
  showContactInfo?: boolean;
  preselectedTeamMember?: string;
  preselectedService?: string;
  preselectedArea?: string;
  darkMode?: boolean;
}

export default function ContactForm({
  showContactInfo = true,
  preselectedTeamMember,
  preselectedService,
  preselectedArea,
  darkMode = false,
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState(preselectedTeamMember || '');
  const [selectedService, setSelectedService] = useState(preselectedService || '');
  const [selectedArea, setSelectedArea] = useState(preselectedArea || '');
  const [customCity, setCustomCity] = useState('');
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    // Find selected names for the message
    const teamMemberName = selectedTeamMember
      ? allTeamMembers.find(m => m.slug === selectedTeamMember)?.name
      : 'First Available';
    const serviceName = selectedService
      ? allServices.find(s => s.slug === selectedService)?.title
      : 'General Inquiry';
    const areaName = selectedArea
      ? activeServiceAreas.find(a => a.slug === selectedArea)?.name
      : 'Not Specified';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          subject: formData.get('subject'),
          message: formData.get('message'),
          preferredTeamMember: teamMemberName,
          serviceType: serviceName,
          serviceArea: areaName,
          city: customCity || areaName,
        }),
      });

      if (response.ok) {
        router.push('/contact/thank-you');
      } else {
        alert('There was a problem submitting your form. Please try again or call us directly.');
        setIsSubmitting(false);
      }
    } catch (error) {
      alert('There was a problem submitting your form. Please try again or call us directly.');
      setIsSubmitting(false);
    }
  };

  // Styling classes based on darkMode
  const labelClass = darkMode
    ? "block text-sm font-semibold text-gray-200"
    : "block text-sm font-semibold text-gray-700";
  const inputClass = darkMode
    ? "w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
    : "w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-colors";
  const selectClass = darkMode
    ? "w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-800 text-white focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
    : "w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-colors bg-white";

  return (
    <div className={`grid ${showContactInfo ? 'md:grid-cols-2' : ''} gap-12 items-start max-w-7xl mx-auto`}>
      {showContactInfo && (
        <div className="space-y-8">
          <div>
            <h2 className={`text-3xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-brand-black'}`}>
              Get In Touch
            </h2>
            <p className={`text-lg mb-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Have questions or ready to schedule your free inspection? Reach out
              to us using any of the methods below.
            </p>
          </div>

          <div className="space-y-6">
            <div className={`flex items-start gap-4 p-6 rounded-2xl border transition-colors ${
              darkMode
                ? 'border-white/20 hover:border-brand-green/50 bg-white/5'
                : 'border-brand-blue/20 hover:border-brand-blue/50 bg-white shadow-sm'
            }`}>
              <div className={`p-3 rounded-xl mt-1 ${darkMode ? 'bg-brand-green/20' : 'bg-brand-blue/10'}`}>
                <MapPin className={`h-6 w-6 ${darkMode ? 'text-brand-green' : 'text-brand-blue'}`} />
              </div>
              <div>
                <h3 className={`font-semibold text-lg mb-1 ${darkMode ? 'text-white' : ''}`}>Our Location</h3>
                <a
                  href="https://maps.google.com/?q=3325+Central+Pkwy+SW,+Decatur,+AL+35603"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`transition-colors ${darkMode ? 'text-gray-300 hover:text-brand-green' : 'text-gray-600 hover:text-brand-blue'}`}
                >
                  3325 Central Pkwy SW
                  <br />
                  Decatur, AL 35603
                </a>
              </div>
            </div>

            <div className={`flex items-start gap-4 p-6 rounded-2xl border transition-colors ${
              darkMode
                ? 'border-white/20 hover:border-brand-green/50 bg-white/5'
                : 'border-brand-blue/20 hover:border-brand-blue/50 bg-white shadow-sm'
            }`}>
              <div className={`p-3 rounded-xl mt-1 ${darkMode ? 'bg-brand-green/20' : 'bg-brand-blue/10'}`}>
                <Phone className={`h-6 w-6 ${darkMode ? 'text-brand-green' : 'text-brand-blue'}`} />
              </div>
              <div>
                <h3 className={`font-semibold text-lg mb-1 ${darkMode ? 'text-white' : ''}`}>Call Us</h3>
                <a
                  href="tel:256-274-8530"
                  className={`text-lg font-semibold transition-colors ${darkMode ? 'text-gray-300 hover:text-brand-green' : 'text-gray-600 hover:text-brand-blue'}`}
                >
                  (256) 274-8530
                </a>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Available 24/7 for emergencies
                </p>
              </div>
            </div>

            <div className={`flex items-start gap-4 p-6 rounded-2xl border transition-colors ${
              darkMode
                ? 'border-white/20 hover:border-brand-green/50 bg-white/5'
                : 'border-brand-blue/20 hover:border-brand-blue/50 bg-white shadow-sm'
            }`}>
              <div className={`p-3 rounded-xl mt-1 ${darkMode ? 'bg-brand-green/20' : 'bg-brand-blue/10'}`}>
                <Mail className={`h-6 w-6 ${darkMode ? 'text-brand-green' : 'text-brand-blue'}`} />
              </div>
              <div>
                <h3 className={`font-semibold text-lg mb-1 ${darkMode ? 'text-white' : ''}`}>Email Us</h3>
                <a
                  href="mailto:office@rcrsal.com"
                  className={`transition-colors ${darkMode ? 'text-gray-300 hover:text-brand-green' : 'text-gray-600 hover:text-brand-blue'}`}
                >
                  office@rcrsal.com
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`p-8 rounded-2xl border shadow-md ${
        darkMode
          ? 'bg-white/10 backdrop-blur-sm border-white/20'
          : 'bg-white border-gray-200'
      }`}>
        <h2 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-brand-black'}`}>
          Request a Free Inspection
        </h2>
        <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Fill out the form below and we'll get back to you shortly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name and Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className={labelClass}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className={labelClass}>
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label htmlFor="phone" className={labelClass}>
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="(555) 555-5555"
              className={inputClass}
            />
          </div>

          {/* Service Type Dropdown */}
          <div className="space-y-2">
            <label htmlFor="serviceType" className={labelClass}>
              Service Needed
            </label>
            <select
              id="serviceType"
              name="serviceType"
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className={selectClass}
            >
              <option value="">General Inquiry</option>
              {allServices.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.title}
                </option>
              ))}
            </select>
          </div>

          {/* Service Area Dropdown */}
          <div className="space-y-2">
            <label htmlFor="serviceArea" className={labelClass}>
              Your Area
            </label>
            <select
              id="serviceArea"
              name="serviceArea"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className={selectClass}
            >
              <option value="">Select Your Area</option>
              {activeServiceAreas.map((area) => (
                <option key={area.slug} value={area.slug}>
                  {area.name}, {area.state}
                </option>
              ))}
              <option value="other">Other Location</option>
            </select>
          </div>

          {/* Custom City Field - Shows when "Other Location" is selected or always visible */}
          <div className="space-y-2">
            <label htmlFor="city" className={labelClass}>
              City/Town {selectedArea === 'other' && <span className="text-red-500">*</span>}
            </label>
            <input
              id="city"
              name="city"
              type="text"
              placeholder="Enter your city or town"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              required={selectedArea === 'other'}
              className={inputClass}
            />
          </div>

          {/* Team Member Dropdown */}
          <div className="space-y-2">
            <label htmlFor="teamMember" className={labelClass}>
              Preferred Team Member (Optional)
            </label>
            <select
              id="teamMember"
              name="teamMember"
              value={selectedTeamMember}
              onChange={(e) => setSelectedTeamMember(e.target.value)}
              className={selectClass}
            >
              <option value="">First Available</option>
              {allTeamMembers.map((member) => (
                <option key={member.slug} value={member.slug}>
                  {member.name} - {member.position}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label htmlFor="subject" className={labelClass}>
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              placeholder="e.g., Roof Inspection, Storm Damage"
              required
              className={inputClass}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label htmlFor="message" className={labelClass}>
              Your Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              placeholder="Tell us about your roofing needs..."
              required
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              darkMode
                ? 'bg-brand-green hover:bg-lime-400 text-black'
                : 'bg-brand-blue hover:bg-blue-700 text-white'
            }`}
          >
            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>

          <p className={`text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            We respect your privacy. Your information will only be used to respond to your inquiry.
          </p>
        </form>
      </div>
    </div>
  );
}
