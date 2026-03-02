import React, { useEffect, useMemo, useState } from 'react';

export interface Step {
  target: string;
  content: React.ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  disableBeacon?: boolean;
}

export interface CallBackProps {
  status: string;
  index: number;
}

export const STATUS = {
  FINISHED: 'finished',
  SKIPPED: 'skipped',
} as const;

interface JoyrideLocale {
  back?: string;
  close?: string;
  last?: string;
  next?: string;
  skip?: string;
}

interface JoyrideStyleOptions {
  options?: React.CSSProperties & {
    zIndex?: number;
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    overlayColor?: string;
  };
  buttonNext?: React.CSSProperties;
  buttonBack?: React.CSSProperties;
  buttonSkip?: React.CSSProperties;
  tooltipContainer?: React.CSSProperties;
}

interface JoyrideProps {
  steps: Step[];
  run?: boolean;
  callback?: (data: CallBackProps) => void;
  continuous?: boolean;
  showProgress?: boolean;
  showSkipButton?: boolean;
  disableScrolling?: boolean;
  locale?: JoyrideLocale;
  styles?: JoyrideStyleOptions;
}

const Joyride: React.FC<JoyrideProps> = ({
  steps,
  run = false,
  callback,
  continuous = false,
  showProgress = false,
  showSkipButton = false,
  locale,
  styles,
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (run) {
      setIndex(0);
    }
  }, [run]);

  const currentStep = useMemo(() => steps[index], [steps, index]);

  useEffect(() => {
    if (!run || !currentStep?.target) return;

    const targetEl = document.querySelector(currentStep.target);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, run]);

  if (!run || !currentStep) return null;

  const finishWithStatus = (status: string) => {
    callback?.({ status, index });
  };

  const handleNext = () => {
    const isLast = index >= steps.length - 1;
    if (isLast) {
      finishWithStatus(STATUS.FINISHED);
      return;
    }
    setIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    setIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: styles?.options?.overlayColor || 'rgba(0,0,0,0.55)',
          zIndex: styles?.options?.zIndex || 10000,
        }}
      />

      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: '2rem',
          transform: 'translateX(-50%)',
          width: 'min(92vw, 460px)',
          zIndex: (styles?.options?.zIndex || 10000) + 1,
          borderRadius: 14,
          backgroundColor: styles?.options?.backgroundColor || '#0f172a',
          color: styles?.options?.textColor || '#f8fafc',
          padding: '1rem',
          ...styles?.tooltipContainer,
        }}
      >
        <div>{currentStep.content}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {showProgress ? `${index + 1}/${steps.length}` : null}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {showSkipButton && (
              <button type="button" onClick={() => finishWithStatus(STATUS.SKIPPED)} style={{ ...styles?.buttonSkip }}>
                {locale?.skip || 'Skip'}
              </button>
            )}
            {continuous && index > 0 && (
              <button type="button" onClick={handleBack} style={{ ...styles?.buttonBack }}>
                {locale?.back || 'Back'}
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              style={{
                backgroundColor: styles?.options?.primaryColor || '#f97316',
                borderRadius: 8,
                color: '#fff',
                border: 'none',
                padding: '0.5rem 0.875rem',
                cursor: 'pointer',
                ...styles?.buttonNext,
              }}
            >
              {index === steps.length - 1 ? locale?.last || 'Done' : locale?.next || 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Joyride;