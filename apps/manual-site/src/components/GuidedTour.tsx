import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface TourStep {
  title: string;
  content: string;
  action?: () => void;
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to RedByte",
    content: "RedByte is a deterministic digital logic simulator that runs entirely in your browser. Every simulation is reproducible—perfect for learning and debugging.",
  },
  {
    title: "Visual Circuit Design",
    content: "Build circuits with gates, wires, and chips using a visual editor. No HDL required—though you can export to Verilog when ready for hardware.",
  },
  {
    title: "Interactive Examples",
    content: "Try the interactive demos to see RedByte in action. Toggle inputs, clock circuits, and scrub through waveforms—all running live in your browser.",
  },
  {
    title: "Built for Education",
    content: "RedByte includes a Lab Workbench for student assignments, automatic grading, and submission inspection—designed for digital logic courses.",
  },
  {
    title: "Ready to Explore?",
    content: "Check out the Getting Started guide, try the examples, or dive into the full manual. Everything runs locally—no server required.",
  },
];

interface GuidedTourProps {
  onClose: () => void;
}

export default function GuidedTour({ onClose }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      // Navigate to examples page on step 3
      if (nextStep === 2) {
        navigate('/examples');
      }
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-rb-surface border border-rb-border rounded-lg max-w-lg w-full mx-4 shadow-xl">
        {/* Progress bar */}
        <div className="h-1 bg-rb-bg rounded-t-lg overflow-hidden">
          <div 
            className="h-full bg-rb-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-rb-text">{step.title}</h3>
            <button
              onClick={onClose}
              className="text-rb-muted hover:text-rb-text transition-colors"
              aria-label="Close tour"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-rb-muted leading-relaxed mb-8">
            {step.content}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-rb-muted">
              Step {currentStep + 1} of {tourSteps.length}
            </div>
            
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 border border-rb-border text-rb-text rounded hover:border-rb-accent transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-rb-accent text-rb-bg font-medium rounded hover:bg-rb-accent-dim transition-colors"
              >
                {currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
