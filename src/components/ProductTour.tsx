import React, { useEffect, useMemo, useRef, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

const TOUR_COMPLETED_KEY = 'trimoveis-product-tour-completed';
const TOUR_PENDING_KEY = 'trimoveis-product-tour-pending';
const TOUR_START_EVENT = 'trimoveis:start-product-tour';
const SIDEBAR_TRANSITION_MS = 360;

interface ProductTourProps {
  forceStart?: boolean;
  isSidebarCollapsed: boolean;
}

const ProductTour: React.FC<ProductTourProps> = ({ forceStart = false, isSidebarCollapsed }) => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const startTimeoutRef = useRef<number | null>(null);

  const steps = useMemo<Step[]>(
    () => [
      {
        target: '#tour-imoveis',
        content: 'Aqui você acessa e gerencia todo o seu portfólio de imóveis. Cadastre, edite e promova.',
        disableBeacon: true,
        placement: 'center',
      },
      {
        target: '#tour-kanban',
        content: 'No Funil de Vendas (Kanban) você visualiza e move os seus clientes por cada etapa da negociação.',
        placement: 'center',
      },
      {
        target: '#tour-config',
        content: 'Em Configurações você ajusta o seu perfil, integrações e acompanha a assinatura do seu plano.',
        placement: 'center',
      },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.innerWidth < 768) return;

    if (forceStart) {
      setStepIndex(0);
      setRun(true);
      return;
    }

    const shouldStart = localStorage.getItem(TOUR_PENDING_KEY) === 'true';
    const alreadyCompleted = localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';

    if (shouldStart && !alreadyCompleted) {
      startTimeoutRef.current = window.setTimeout(() => {
        setStepIndex(0);
        setRun(true);
      }, SIDEBAR_TRANSITION_MS);
    }

    const startTour = () => {
      localStorage.setItem(TOUR_PENDING_KEY, 'true');
      localStorage.removeItem(TOUR_COMPLETED_KEY);
      setStepIndex(0);
      setRun(true);
    };

    window.addEventListener(TOUR_START_EVENT, startTour);

    return () => {
      if (startTimeoutRef.current) {
        window.clearTimeout(startTimeoutRef.current);
      }

      window.removeEventListener(TOUR_START_EVENT, startTour);
    };
  }, [forceStart]);

  useEffect(() => {
    if (!run) return;

    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, SIDEBAR_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [run, isSidebarCollapsed, stepIndex]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;

    if (type === 'error:target_not_found') {
      const nextIndex = Math.min(index + 1, steps.length - 1);
      setStepIndex(nextIndex);
      return;
    }

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      localStorage.removeItem(TOUR_PENDING_KEY);
      setRun(false);
      setStepIndex(0);
      return;
    }

    if (type === 'step:after') {
      const nextIndex = index + (action === 'prev' ? -1 : 1);
      setStepIndex(nextIndex);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrolling
      disableScrollParentFix={false}
      disableOverlayClose
      spotlightClicks
      spotlightPadding={10}
      floaterProps={{
        disableAnimation: true,
        hideArrow: false,
      }}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Finalizar',
        next: 'Próximo',
        skip: 'Pular tour',
      }}
      styles={{
        options: {
          arrowColor: '#0f172a',
          backgroundColor: '#0f172a',
          overlayColor: 'rgba(15, 23, 42, 0.85)',
          primaryColor: '#8b5cf6',
          textColor: '#e2e8f0',
          zIndex: 999999,
        },
        buttonNext: { fontWeight: 700, borderRadius: '8px' },
        buttonBack: { color: '#94a3b8' },
        buttonSkip: { color: '#cbd5e1' },
        tooltipContainer: {
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
          textAlign: 'left',
          boxShadow: '0 20px 45px rgba(2, 6, 23, 0.6)',
        },
      }}
    />
  );

  
  return typeof document !== 'undefined' ? createPortal(tourComponent, document.body) : null;
};

export default ProductTour;