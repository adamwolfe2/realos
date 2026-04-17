"use client";

import {
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  Phone,
  Mail,
  ExternalLink,
  Award,
} from "lucide-react";
import type { ViewProps } from "./types";

export function AboutView({ brand, data }: ViewProps) {
  const socials = Object.entries(data.socialLinks || {}).filter(([, url]) => url && url.trim() !== "");

  return (
    <div className="p-6 sm:p-8 bg-cream">
      <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">About Us</p>
      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink mb-6">{data.companyName}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="sm:col-span-2 space-y-6">
          <div className="border border-shell bg-cream p-6">
            <p className="font-sans text-sm text-ink/80 leading-relaxed">{data.aboutSnippet || data.companyDescription}</p>
          </div>

          {/* Value Propositions */}
          {data.valuePropositions.length > 0 && (
            <div className="border border-shell bg-cream p-6">
              <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-4">Why Choose Us</p>
              <div className="space-y-3">
                {data.valuePropositions.map((vp, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${brand.color}15` }}>
                      <CheckCircle2 className="w-3 h-3" style={{ color: brand.color }} />
                    </div>
                    <span className="font-sans text-sm text-ink/80">{vp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {data.certifications.length > 0 && (
            <div className="border border-shell bg-cream p-6">
              <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-4">Certifications</p>
              <div className="flex flex-wrap gap-2">
                {data.certifications.map((cert, i) => (
                  <span key={i} className="border border-shell px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink/60 flex items-center gap-1.5">
                    <Award className="w-3 h-3" /> {cert}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Company Info */}
          <div className="border border-shell bg-cream p-5">
            <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-4">Company Info</p>
            <div className="space-y-3">
              {data.yearFounded && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-sand" />
                  <span className="font-mono text-xs text-ink/70">Founded {data.yearFounded}</span>
                </div>
              )}
              {data.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-sand" />
                  <span className="font-mono text-xs text-ink/70">{data.location}</span>
                </div>
              )}
              {data.industry && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-sand" />
                  <span className="font-mono text-xs text-ink/70">{data.industry}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="border border-shell bg-cream p-5">
            <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-4">Contact</p>
            <div className="space-y-3">
              {data.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-sand" />
                  <span className="font-mono text-xs text-ink/70">{data.phone}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-sand" />
                  <span className="font-mono text-xs text-ink/70">{data.email}</span>
                </div>
              )}
              {data.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-sand" />
                  <span className="font-mono text-xs text-ink/70">{data.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Social Links */}
          {socials.length > 0 && (
            <div className="border border-shell bg-cream p-5">
              <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-4">Social</p>
              <div className="space-y-2">
                {socials.map(([platform, url]) => (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-mono text-xs text-ink/70 hover:text-ink">
                    <ExternalLink className="w-3 h-3 text-sand" />
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
