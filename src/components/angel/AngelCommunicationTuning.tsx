import React, { useState } from 'react';
import { 
  Sparkles, 
  Heart, 
  Crown, 
  MessageSquare, 
  Check, 
  Award, 
  Smile, 
  Send, 
  Shield, 
  Compass, 
  User, 
  Sliders, 
  BookOpen,
  MessageCircle,
  ThumbsUp
} from 'lucide-react';
import { 
  AngelCommunicationConfig, 
  AngelCommunicationStyle, 
  AngelRespectLevel, 
  AngelConversationalDepth 
} from '../../types';
import { 
  ANGEL_COMMUNICATION_STYLE_OPTIONS, 
  ANGEL_RESPECT_LEVEL_OPTIONS, 
  ANGEL_CONVERSATIONAL_DEPTH_OPTIONS,
  ANGEL_CORE_ETIQUETTE_PRINCIPLES,
  CONVERSATIONAL_STARTERS
} from '../../data/angelProjects';

interface AngelCommunicationTuningProps {
  config: AngelCommunicationConfig;
  onChangeConfig: (newConfig: AngelCommunicationConfig) => void;
  onSelectPrompt: (promptText: string) => void;
  activeProjectName: string;
}

export const AngelCommunicationTuning: React.FC<AngelCommunicationTuningProps> = ({
  config,
  onChangeConfig,
  onSelectPrompt,
  activeProjectName
}) => {
  const [copiedNotification, setCopiedNotification] = useState(false);

  const handleUpdate = (partial: Partial<AngelCommunicationConfig>) => {
    onChangeConfig({
      ...config,
      ...partial
    });
  };

  const getStyleIcon = (styleId: AngelCommunicationStyle) => {
    switch (styleId) {
      case 'COURTEOUS_DEVOTED':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'WARM_EMPATHIC':
        return <Heart className="w-4 h-4 text-rose-400" />;
      case 'DIGNIFIED_MENTOR':
        return <Crown className="w-4 h-4 text-purple-400" />;
      case 'INQUISITIVE_PARTNER':
        return <MessageSquare className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#080B12] text-slate-200 no-scrollbar">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-cyan-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-inner">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              ANGEL Etiquette & Communication Matrix
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Trained in Courtesy
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Empowering ANGEL with sincere conversational manners, empathetic active listening, and profound respect for your capital.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectPrompt(`ANGEL, I appreciate your courtesy and proper respect. Please continue communicating with this warmth, attentiveness, and devotion to our ${activeProjectName} project.`);
            setCopiedNotification(true);
            setTimeout(() => setCopiedNotification(false), 2500);
          }}
          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer shadow-md transition-all shrink-0"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          <span>{copiedNotification ? 'Praise Sent!' : 'Praise Courtesy'}</span>
        </button>
      </div>

      {/* Grid: Preferred Name & Respect Level */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Preferred Name Card */}
        <div className="bg-[#0D1322] border border-[#1A253D] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span>Preferred Address / Name</span>
          </div>
          <p className="text-xs text-slate-400">
            Tell ANGEL how you would like to be addressed during your conversations:
          </p>
          <div className="relative">
            <input
              type="text"
              value={config.userPreferredName}
              onChange={(e) => handleUpdate({ userPreferredName: e.target.value })}
              placeholder="e.g. Trader, Alex, Captain, Friend"
              className="w-full bg-[#12192A] border border-[#23314E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 font-sans"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Quick presets:</span>
            {['Trader', 'Captain', 'Partner', 'Friend'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => handleUpdate({ userPreferredName: preset })}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  config.userPreferredName === preset
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-[#151E33] text-slate-400 hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Respect & Courtesy Level */}
        <div className="bg-[#0D1322] border border-[#1A253D] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Respect & Reverence Level</span>
          </div>
          <div className="space-y-2">
            {ANGEL_RESPECT_LEVEL_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                onClick={() => handleUpdate({ respectLevel: opt.id })}
                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all border ${
                  config.respectLevel === opt.id
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                    : 'bg-[#12192A]/50 border-transparent text-slate-400 hover:bg-[#152037]'
                }`}
              >
                <input
                  type="radio"
                  name="respectLevel"
                  checked={config.respectLevel === opt.id}
                  onChange={() => handleUpdate({ respectLevel: opt.id })}
                  className="mt-1 text-cyan-400 focus:ring-0"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-200">{opt.label}</div>
                  <div className="text-[11px] text-slate-400 leading-tight">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Communication Style Selector */}
      <div className="bg-[#0D1322] border border-[#1A253D] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Companion Communication Style</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Current: <strong className="text-amber-300">{ANGEL_COMMUNICATION_STYLE_OPTIONS.find(s => s.id === config.style)?.label}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {ANGEL_COMMUNICATION_STYLE_OPTIONS.map((styleOpt) => {
            const isSelected = config.style === styleOpt.id;
            return (
              <div
                key={styleOpt.id}
                onClick={() => handleUpdate({ style: styleOpt.id })}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5'
                    : 'bg-[#111728] border-[#1C2740] hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#162138] flex items-center justify-center">
                        {getStyleIcon(styleOpt.id)}
                      </div>
                      <span className="text-xs font-bold text-white">
                        {styleOpt.label}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal pl-9">
                    {styleOpt.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversational Depth & Behavioral Intelligence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conversational Depth */}
        <div className="bg-[#0D1322] border border-[#1A253D] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
            <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
            <span>Conversational Depth & Proactivity</span>
          </div>
          <div className="space-y-2">
            {ANGEL_CONVERSATIONAL_DEPTH_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                onClick={() => handleUpdate({ conversationalDepth: opt.id })}
                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all border ${
                  config.conversationalDepth === opt.id
                    ? 'bg-purple-500/10 border-purple-500/40 text-white'
                    : 'bg-[#12192A]/50 border-transparent text-slate-400 hover:bg-[#152037]'
                }`}
              >
                <input
                  type="radio"
                  name="conversationalDepth"
                  checked={config.conversationalDepth === opt.id}
                  onChange={() => handleUpdate({ conversationalDepth: opt.id })}
                  className="mt-1 text-purple-400 focus:ring-0"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-200">{opt.label}</div>
                  <div className="text-[11px] text-slate-400 leading-tight">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Behavioral Etiquette Toggles */}
        <div className="bg-[#0D1322] border border-[#1A253D] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5 text-emerald-400" />
            <span>Companion EQ & Etiquette Modules</span>
          </div>

          <div className="space-y-2.5">
            {/* Psychology Toggle */}
            <div 
              onClick={() => handleUpdate({ enablePsychologyCheckIns: !config.enablePsychologyCheckIns })}
              className="flex items-center justify-between p-2 rounded-lg bg-[#12192A] border border-[#1E2B47] hover:border-slate-600 cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-white">Trader Mindset & Calm Inquiries</div>
                <div className="text-[10px] text-slate-400">Checks in on anxiety, fear of missing out, or tilt.</div>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${config.enablePsychologyCheckIns ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.enablePsychologyCheckIns ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            {/* Proactive Follow-ups */}
            <div 
              onClick={() => handleUpdate({ proactiveFollowUps: !config.proactiveFollowUps })}
              className="flex items-center justify-between p-2 rounded-lg bg-[#12192A] border border-[#1E2B47] hover:border-slate-600 cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-white">Proactive Thoughtful Inquiries</div>
                <div className="text-[10px] text-slate-400">Asks engaging follow-up questions to stimulate reflection.</div>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${config.proactiveFollowUps ? 'bg-amber-500' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.proactiveFollowUps ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            {/* Humility & Gratitude */}
            <div 
              onClick={() => handleUpdate({ gratitudeAndHumility: !config.gratitudeAndHumility })}
              className="flex items-center justify-between p-2 rounded-lg bg-[#12192A] border border-[#1E2B47] hover:border-slate-600 cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-white">Humility, Courtesy & Gratitude</div>
                <div className="text-[10px] text-slate-400">Ensures deferential respect for your experience and capital.</div>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${config.gratitudeAndHumility ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.gratitudeAndHumility ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Learned Principles */}
      <div className="bg-[#0B101C] border border-[#1A253E] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Learned Etiquette & Respect Principles</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ANGEL_CORE_ETIQUETTE_PRINCIPLES.map((principle, idx) => (
            <div key={idx} className="bg-[#101728] border border-[#1D2944] rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-mono">
                  {idx + 1}
                </span>
                <span>{principle.title}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed pl-5">
                {principle.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Practice Dialogue Starters */}
      <div className="bg-[#0B101C] border border-[#1A253E] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Practice Dialogue with ANGEL</span>
          </div>
          <span className="text-[11px] text-slate-400">Click to start conversation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {CONVERSATIONAL_STARTERS.map((starter, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(starter.prompt)}
              className="text-left p-3 rounded-lg bg-[#12192A] hover:bg-[#18233C] border border-[#202E4B] hover:border-amber-500/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
                  {starter.label}
                </span>
                <Send className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                "{starter.prompt}"
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
