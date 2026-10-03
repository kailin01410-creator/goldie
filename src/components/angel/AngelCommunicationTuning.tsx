import React, { useEffect, useState } from 'react';
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
  ThumbsUp,
  Database,
  Brain,
  Layers,
  ChevronDown,
  ChevronRight,
  Zap,
  Play
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
import {
  COMMUNICATION_CORPUS_VOLUMES,
  COMMUNICATION_VOLUME_COUNT,
  GEMINI_COMMUNICATION_MODES,
  CONVERSATIONAL_STARTER_PROMPTS
} from '../../data/communicationDataset';

/**
 * Live, measured figures from GET /api/angel/knowledge.
 *
 * This panel used to display invented constants ("5.0 GB data set", "2,100
 * heuristics", "99.4% EQ rating", a model that does not exist). Everything
 * below is counted from the data that is actually loaded, so the numbers move
 * when the corpus does — and can be verified.
 */
interface KnowledgeReport {
  communication: { exemplars: number; principles: number; patterns: number; intents: number; languages: string[]; characters: number };
  finance: { entries: number; playbooks: number; formulas: number; domains: number; characters: number };
  userMemory: { documents: number; inactive: number; characters: number };
  index: { documents: number; chunks: number; terms: number; characters: number };
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

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
  const [knowledge, setKnowledge] = useState<KnowledgeReport | null>(null);
  const [activeModel, setActiveModel] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [knowledgeResponse, statusResponse] = await Promise.all([
          fetch('/api/angel/knowledge'),
          fetch('/api/angel/status'),
        ]);
        if (cancelled) return;
        if (knowledgeResponse.ok) setKnowledge(await knowledgeResponse.json());
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          setActiveModel(status?.activeModel ?? null);
        }
      } catch {
        // Offline: the strip below shows "—" rather than a made-up figure.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [expandedVolumeId, setExpandedVolumeId] = useState<string>('vol-1-empathy');

  const handleUpdate = (partial: Partial<AngelCommunicationConfig>) => {
    onChangeConfig({
      ...config,
      ...partial
    });
  };

  const getStyleIcon = (styleId: AngelCommunicationStyle) => {
    switch (styleId) {
      case 'GEMINI_COMPANION':
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
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
      
      {/* Communication corpus banner — figures below are measured live. */}
      <div className="bg-gradient-to-r from-amber-500/15 via-cyan-500/15 to-purple-500/15 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/25 to-cyan-500/30 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
              <Brain className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                  How ANGEL talks to you
                </h3>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {COMMUNICATION_VOLUME_COUNT} written volumes
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
                The settings here shape tone and length. The retrieval corpus below is what ANGEL
                actually draws on when choosing how to phrase a reply — every figure is counted
                from the loaded data, not asserted.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                onSelectPrompt(`Hello ANGEL! How are you doing today? I would love to just talk and check in with you like a true friend and companion.`);
                setCopiedNotification(true);
                setTimeout(() => setCopiedNotification(false), 2500);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 transition-all shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{copiedNotification ? 'Sent to Chat!' : 'Test Gemini Companion'}</span>
            </button>
          </div>
        </div>

        {/* Measured corpus metrics — counted live, never asserted. */}
        <div className="mt-4 pt-3.5 border-t border-[#23314E]/60 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="bg-[#0A0F1D]/80 border border-[#1C2740] rounded-lg px-3 py-2" title="Worked dialogue examples ANGEL retrieves from when choosing how to phrase a reply.">
            <span className="text-slate-400 text-[10px] block">STYLE EXAMPLES</span>
            <span className="text-amber-300 font-bold text-sm">
              {knowledge ? `${knowledge.communication.exemplars} across ${knowledge.communication.languages.join('/')}` : '—'}
            </span>
          </div>
          <div className="bg-[#0A0F1D]/80 border border-[#1C2740] rounded-lg px-3 py-2" title="Finance definitions, formulas and playbooks available for grounding.">
            <span className="text-slate-400 text-[10px] block">FINANCE KNOWLEDGE</span>
            <span className="text-cyan-300 font-bold text-sm">
              {knowledge ? `${knowledge.finance.entries} entries · ${knowledge.finance.formulas} formulas` : '—'}
            </span>
          </div>
          <div className="bg-[#0A0F1D]/80 border border-[#1C2740] rounded-lg px-3 py-2" title="Searchable chunks in the retrieval index, including your own uploads.">
            <span className="text-slate-400 text-[10px] block">SEARCH INDEX</span>
            <span className="text-emerald-300 font-bold text-sm">
              {knowledge ? `${compactNumber(knowledge.index.chunks)} chunks · ${compactNumber(knowledge.index.characters)} chars` : '—'}
            </span>
          </div>
          <div className="bg-[#0A0F1D]/80 border border-[#1C2740] rounded-lg px-3 py-2" title="The model currently answering. Falls back to the offline core if it is unreachable.">
            <span className="text-slate-400 text-[10px] block">LANGUAGE MODEL</span>
            <span className={`font-bold text-sm ${activeModel ? 'text-purple-300' : 'text-amber-300'}`}>
              {activeModel === undefined ? '—' : (activeModel ?? 'offline core only')}
            </span>
          </div>
        </div>
      </div>

      {/* 5 Master Communication Volumes Explorer */}
      <div className="bg-[#0D1322] border border-[#1E2B47] rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Written communication volumes ({COMMUNICATION_VOLUME_COUNT})
            </h4>
          </div>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            Click any volume to inspect learned human dialogue directives
          </span>
        </div>

        <div className="space-y-2.5">
          {COMMUNICATION_CORPUS_VOLUMES.map((vol) => {
            const isExpanded = expandedVolumeId === vol.id;
            return (
              <div 
                key={vol.id}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isExpanded 
                    ? 'bg-[#10172B] border-cyan-500/40 shadow-lg shadow-cyan-500/5' 
                    : 'bg-[#0B101C] border-[#18233B] hover:border-slate-600'
                }`}
              >
                {/* Volume Header Toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedVolumeId(isExpanded ? '' : vol.id)}
                  className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                      V{vol.volumeNumber}
                    </span>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                        <span>{vol.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {vol.sizeGb} GB
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {vol.topicsCount} Topics
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{vol.subtitle}</p>
                    </div>
                  </div>

                  <div className="text-slate-400 shrink-0 ml-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Volume Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#1C2842] space-y-3 font-sans animate-fadeIn">
                    <p className="text-xs text-slate-300 italic">
                      "{vol.description}"
                    </p>

                    <div className="space-y-2.5">
                      {vol.corePrinciples.map((principle, pIdx) => (
                        <div key={pIdx} className="bg-[#0C1220] border border-[#19243C] rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>{principle.name}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed pl-3">
                            {principle.directive}
                          </p>

                          {/* Example Human Exchange */}
                          <div className="bg-[#080D18] border border-[#151E33] rounded-md p-2.5 text-[11px] font-mono space-y-1.5">
                            <div className="text-slate-400 flex items-start gap-1.5">
                              <span className="text-cyan-400 font-bold shrink-0">Trader:</span>
                              <span className="text-slate-200">"{principle.exampleExchange.user}"</span>
                            </div>
                            <div className="text-slate-300 flex items-start gap-1.5 pl-2 border-l border-amber-500/30">
                              <span className="text-amber-400 font-bold shrink-0">ANGEL:</span>
                              <span className="text-amber-100 font-sans">{principle.exampleExchange.angel}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Preferred Name & Communication Style */}
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
              placeholder="e.g. Kailin, Trader, Captain, Friend"
              className="w-full bg-[#12192A] border border-[#23314E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 font-sans"
            />
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Currently addressing you as: <strong className="text-amber-300">{config.userPreferredName || 'Trader'}</strong></span>
          </div>
        </div>

        {/* Respect & Courtesy Level */}
        <div className="bg-[#0D1322] border border-[#1A253D] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
            <Crown className="w-3.5 h-3.5 text-purple-400" />
            <span>Respect & Courtesy Calibrator</span>
          </div>
          <div className="space-y-2">
            {ANGEL_RESPECT_LEVEL_OPTIONS.map((opt) => (
              <label 
                key={opt.id}
                className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                  config.respectLevel === opt.id 
                    ? 'bg-[#181F33] border-purple-500/50 text-white' 
                    : 'bg-[#12192A] border-transparent text-slate-300 hover:bg-[#151D30]'
                }`}
              >
                <input
                  type="radio"
                  name="respectLevel"
                  value={opt.id}
                  checked={config.respectLevel === opt.id}
                  onChange={() => handleUpdate({ respectLevel: opt.id })}
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
      </div>

      {/* Style Matrix Options */}
      <div className="bg-[#0D1322] border border-[#1A253D] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Conversational Persona & Companion Tone</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono font-semibold">
            Active: {ANGEL_COMMUNICATION_STYLE_OPTIONS.find(s => s.id === config.style)?.label || 'Gemini Companion'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ANGEL_COMMUNICATION_STYLE_OPTIONS.map((style) => {
            const isSelected = config.style === style.id;
            return (
              <div
                key={style.id}
                onClick={() => handleUpdate({ style: style.id })}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-[#172238] border-amber-400/80 shadow-md shadow-amber-500/10' 
                    : 'bg-[#10172A] border-[#1E2C4A] hover:border-slate-500 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 font-bold text-xs text-white">
                      {getStyleIcon(style.id)}
                      <span>{style.label}</span>
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {style.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Depth & Emotional Intelligence Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conversational Depth */}
        <div className="bg-[#0D1322] border border-[#1A253D] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Conversational Depth & Pacing</span>
          </div>
          <div className="space-y-2">
            {ANGEL_CONVERSATIONAL_DEPTH_OPTIONS.map((opt) => (
              <label 
                key={opt.id}
                className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                  config.conversationalDepth === opt.id 
                    ? 'bg-[#181F33] border-cyan-500/50 text-white' 
                    : 'bg-[#12192A] border-transparent text-slate-300 hover:bg-[#151D30]'
                }`}
              >
                <input
                  type="radio"
                  name="conversationalDepth"
                  value={opt.id}
                  checked={config.conversationalDepth === opt.id}
                  onChange={() => handleUpdate({ conversationalDepth: opt.id })}
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

      {/* Practice Dialogue Starters */}
      <div className="bg-[#0B101C] border border-[#1A253E] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Human-to-Human Companion Dialogue Starters</span>
          </div>
          <span className="text-[11px] text-slate-400">Click to start conversation in chat</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {CONVERSATIONAL_STARTER_PROMPTS.map((starter, idx) => (
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
