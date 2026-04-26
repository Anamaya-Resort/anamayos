'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, Lock } from 'lucide-react';

interface FormQuestion {
  question: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  is_active: boolean;
  help_text: string;
  _locked?: boolean; // client-only flag
}

const LOCKED_QUESTIONS_APPLICATION = new Set(['Full Name', 'Email', 'Phone Number']);
const LOCKED_QUESTIONS_INTAKE = new Set(['Full Name', 'Email', 'Phone Number', 'Emergency contact: full name, relationship, phone number, and email.']);

const APPLICATION_TEMPLATE: FormQuestion[] = [
  { question: 'Full Name', question_type: 'text', options: [], is_required: true, is_active: true, help_text: '', _locked: true },
  { question: 'Email', question_type: 'text', options: [], is_required: true, is_active: true, help_text: '', _locked: true },
  { question: 'Phone Number', question_type: 'text', options: [], is_required: true, is_active: true, help_text: '', _locked: true },
  { question: 'How long have you been practicing yoga, and how often do you currently practice?', question_type: 'textarea', options: [], is_required: true, is_active: true, help_text: '' },
  { question: 'What style(s) of yoga do you typically practice?', question_type: 'multiselect', options: ['Vinyasa','Ashtanga','Hatha','Yin','Kundalini','Iyengar','Restorative','Bikram/Hot','Other'], is_required: true, is_active: true, help_text: '' },
  { question: 'Have you previously attended any yoga retreats, workshops, or teacher training programs?', question_type: 'textarea', options: [], is_required: false, is_active: true, help_text: '' },
  { question: 'Why do you want to attend this retreat? What do you most hope to gain?', question_type: 'textarea', options: [], is_required: true, is_active: true, help_text: '' },
  { question: 'Describe any injuries, disabilities, physical limitations, or illnesses we should be aware of.', question_type: 'textarea', options: [], is_required: true, is_active: true, help_text: '' },
  { question: 'Are you currently under the care of a mental health professional?', question_type: 'select', options: ['No','Yes — currently','Yes — within the past 12 months'], is_required: true, is_active: true, help_text: '' },
  { question: 'Are you currently taking any psychiatric or prescription medications?', question_type: 'select', options: ['No','Yes'], is_required: true, is_active: true, help_text: '' },
  { question: 'What is your current fitness level?', question_type: 'select', options: ['Beginner','Moderate','Active','Very Active'], is_required: true, is_active: true, help_text: '' },
  { question: 'Is there anything else you would like us to know about you?', question_type: 'textarea', options: [], is_required: false, is_active: true, help_text: '' },
];

const INTAKE_TEMPLATE: FormQuestion[] = [
  { question: 'Full Name', question_type: 'text', options: [], is_required: true, is_active: true, help_text: '', _locked: true },
  { question: 'Email', question_type: 'text', options: [], is_required: true, is_active: true, help_text: '', _locked: true },
  { question: 'Phone Number', question_type: 'text', options: [], is_required: true, is_active: true, help_text: '', _locked: true },
  { question: 'Please list any medical conditions, allergies, or injuries.', question_type: 'textarea', options: [], is_required: true, is_active: true, help_text: '' },
  { question: 'List all medications and supplements you are currently taking.', question_type: 'textarea', options: [], is_required: false, is_active: true, help_text: '' },
  { question: 'Do you have any dietary restrictions or food allergies?', question_type: 'multiselect', options: ['None','Vegetarian','Vegan','Gluten-Free','Dairy-Free','Nut Allergy','Shellfish Allergy','Kosher','Halal','Raw Food','Other'], is_required: true, is_active: true, help_text: '' },
  { question: 'What is your planned arrival date and approximate time?', question_type: 'text', options: [], is_required: true, is_active: true, help_text: '' },
  { question: 'What is your planned departure date and approximate time?', question_type: 'text', options: [], is_required: true, is_active: true, help_text: '' },
  { question: 'Do you need transportation from the airport?', question_type: 'select', options: ['No — I have my own transport','Yes — please arrange pickup','I would like information about options'], is_required: false, is_active: true, help_text: '' },
  { question: 'What is your room type preference?', question_type: 'select', options: ['Private Room','Shared Room','Dormitory','No preference'], is_required: true, is_active: true, help_text: '' },
  { question: 'Do you have a specific roommate request?', question_type: 'text', options: [], is_required: false, is_active: true, help_text: '' },
  { question: 'What is your experience level with the primary retreat activity?', question_type: 'select', options: ['Complete Beginner','Some Experience','Intermediate','Advanced'], is_required: true, is_active: true, help_text: '' },
  { question: 'What do you most hope to gain from this retreat?', question_type: 'textarea', options: [], is_required: false, is_active: true, help_text: '' },
  { question: 'Emergency contact: full name, relationship, phone number, and email.', question_type: 'textarea', options: [], is_required: true, is_active: true, help_text: '', _locked: true },
  { question: 'Do you have travel insurance? If yes, provide your policy number and provider.', question_type: 'text', options: [], is_required: false, is_active: true, help_text: '' },
  { question: 'Do you consent to photos/videos being taken during the retreat for promotional use?', question_type: 'select', options: ['Yes','No','Yes — but not my face','Please ask me first'], is_required: true, is_active: true, help_text: '' },
  { question: 'Do you acknowledge the retreat cancellation and refund policy?', question_type: 'checkbox', options: [], is_required: true, is_active: true, help_text: '' },
];

interface Props {
  retreatId: string;
  formType: 'application' | 'intake';
  title: string;
  description: string;
  topMessage: string;
}

export function FormBuilderPanel({ retreatId, formType, title, description, topMessage }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [welcomeText, setWelcomeText] = useState('');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lockedSet = formType === 'application' ? LOCKED_QUESTIONS_APPLICATION : LOCKED_QUESTIONS_INTAKE;
  const template = formType === 'application' ? APPLICATION_TEMPLATE : INTAKE_TEMPLATE;

  // Load from API
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/retreat-forms?retreatId=${retreatId}`);
      const data = await res.json();
      const form = (data.forms ?? []).find((f: Record<string, unknown>) => f.form_type === formType);
      if (form) {
        setEnabled(form.is_enabled === true);
        setWelcomeText((form.description as string) ?? '');
        const qs = ((form.questions as FormQuestion[]) ?? []).map((q) => ({
          ...q,
          _locked: lockedSet.has(q.question),
        }));
        setQuestions(qs);
      } else {
        // Seed from template
        setQuestions(template.map((q) => ({ ...q, _locked: lockedSet.has(q.question) })));
      }
      setLoaded(true);
    })();
  }, [retreatId, formType, lockedSet, template]);

  // Debounced save
  const save = useCallback(async (en: boolean, desc: string, qs: FormQuestion[]) => {
    await fetch('/api/admin/retreat-forms', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retreat_id: retreatId,
        form_type: formType,
        is_enabled: en,
        title,
        description: desc,
        questions: qs.map((q) => ({
          question: q.question,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          is_active: q.is_active,
          help_text: q.help_text,
        })),
      }),
    });
  }, [retreatId, formType, title]);

  const triggerSave = useCallback((en: boolean, desc: string, qs: FormQuestion[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(en, desc, qs), 500);
  }, [save]);

  const toggleEnabled = (val: boolean) => {
    setEnabled(val);
    triggerSave(val, welcomeText, questions);
  };

  const updateWelcome = (val: string) => {
    setWelcomeText(val);
    triggerSave(enabled, val, questions);
  };

  const updateQuestion = (idx: number, partial: Partial<FormQuestion>) => {
    const next = questions.map((q, i) => i === idx ? { ...q, ...partial } : q);
    setQuestions(next);
    triggerSave(enabled, welcomeText, next);
  };

  const removeQuestion = (idx: number) => {
    const next = questions.filter((_, i) => i !== idx);
    setQuestions(next);
    triggerSave(enabled, welcomeText, next);
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    setQuestions(next);
    triggerSave(enabled, welcomeText, next);
  };

  const addQuestion = () => {
    const next = [...questions, { question: '', question_type: 'text', options: [], is_required: false, is_active: true, help_text: '' }];
    setQuestions(next);
    triggerSave(enabled, welcomeText, next);
  };

  if (!loaded) return null;

  // Three-way requirement label
  const reqLabel = (q: FormQuestion) => {
    if (!q.is_active) return 'not_needed';
    return q.is_required ? 'required' : 'optional';
  };

  const setReqLevel = (idx: number, level: 'required' | 'optional' | 'not_needed') => {
    switch (level) {
      case 'required': updateQuestion(idx, { is_required: true, is_active: true }); break;
      case 'optional': updateQuestion(idx, { is_required: false, is_active: true }); break;
      case 'not_needed': updateQuestion(idx, { is_required: false, is_active: false }); break;
    }
  };

  return (
    <div className="space-y-3">
        {/* Top message */}
        <div className="flex items-start gap-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{topMessage}</p>
        </div>

        {/* Enable toggle */}
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => toggleEnabled(e.target.checked)} className="rounded border" />
          {description}
        </label>

        {enabled && (
          <>
            {/* Welcome text */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Welcome / Intro Message</label>
              <textarea value={welcomeText} onChange={(e) => updateWelcome(e.target.value)}
                placeholder="Write a message that appears at the top of the form..."
                rows={3} className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
            </div>

            {/* Questions list */}
            <div className="space-y-1.5">
              {questions.map((q, i) => {
                const level = reqLabel(q);
                const isLocked = !!q._locked;
                return (
                  <div key={i} className={`flex items-start gap-2 rounded border px-2.5 py-2 ${!q.is_active ? 'opacity-40' : ''}`}>
                    {/* Reorder */}
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <button onClick={() => moveQuestion(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Question text */}
                    <div className="flex-1 min-w-0">
                      <input value={q.question} onChange={(e) => updateQuestion(i, { question: e.target.value })}
                        disabled={isLocked} placeholder="Question text"
                        className="w-full rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-70" />
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{q.question_type}</span>
                        {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Three-way toggle */}
                    <div className="flex rounded border overflow-hidden shrink-0">
                      {(['required', 'optional', 'not_needed'] as const).map((lvl) => (
                        <button key={lvl} onClick={() => !isLocked && setReqLevel(i, lvl)}
                          disabled={isLocked}
                          className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                            level === lvl
                              ? lvl === 'required' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : lvl === 'optional' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                              : 'text-muted-foreground hover:bg-muted'
                          } ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          {lvl === 'not_needed' ? 'Not Needed' : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Delete */}
                    {!isLocked && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => removeQuestion(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <Button size="sm" variant="outline" onClick={addQuestion} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Custom Question
            </Button>
          </>
        )}
    </div>
  );
}
