import React from 'react';
import { Plus } from 'lucide-react';
import type { HelpFaq } from '../../data/helpFaqs';

/** Native disclosure supplies keyboard, expanded-state and focus semantics without a JS animation. */
export function FaqAccordion({ questions }: { questions: readonly HelpFaq[] }) {
  return (
    <div className="help-accordion">
      {questions.map(question => (
        <details key={question.id} className="help-question">
          <summary><span>{question.question}</span><Plus size={18} aria-hidden="true" /></summary>
          <div className="help-answer">
            <p>{question.answer}</p>
            {question.link && (
              <a className="home-text-action" href={question.link.href}>
                {question.link.label} <span aria-hidden="true">→</span>
              </a>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
