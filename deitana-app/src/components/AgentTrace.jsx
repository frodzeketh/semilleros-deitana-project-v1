import React, { useState } from 'react';
import { BrainCircuit, TextSelect, ChevronDown, ChevronUp } from 'lucide-react';

// Iconos simulados para los que no tenemos en Lucide

const Zap = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const Search = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FileText = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const File = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const Settings = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);


const getStepIcon = (type, icon, title) => {
  if (icon) {
    return <span className="text-lg">{icon}</span>
  }

  // Detectar si es un paso conversacional por el título
  const isConversational = title && (
    title.includes('conversacional') || 
    title.includes('respuesta') ||
    title.includes('lenguaje natural')
  );

  switch (type) {
    case "thought":
      return <BrainCircuit className="agent-trace-icon agent-trace-icon-brain" size={16} />
    case "action":
      return <Zap className="agent-trace-icon agent-trace-icon-zap" />
    case "tool":
      return isConversational ? 
        <TextSelect className="agent-trace-icon agent-trace-icon-conversation" size={16} /> :
        <Search className="agent-trace-icon agent-trace-icon-search" />
    case "result":
      return <FileText className="agent-trace-icon agent-trace-icon-file" />
    default:
      return <div className="agent-trace-icon-default" />
  }
}

const getFileIcon = (filename) => {
  if (filename.includes(".tsx") || filename.includes(".ts")) {
    return (
      <div className="agent-trace-file-ts">
        <span className="agent-trace-file-ts-text">TS</span>
      </div>
    )
  }
  if (filename.includes(".css")) {
    return <Settings className="agent-trace-icon-settings" />
  }
  return <File className="agent-trace-icon-settings" />
}

export function AgentTrace({ steps, isCollapsed = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredStep, setHoveredStep] = useState(null);

  // Si no está colapsado, mostrar el thinking normal
  if (!isCollapsed) {
    return (
      <div className="agent-trace-container">
        <div className="agent-trace-relative">
          <div className="agent-trace-line"></div>

          <div className="agent-trace-steps">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="agent-trace-step interactive-step"
                onMouseEnter={() => setHoveredStep(step.id)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <div className="agent-trace-icon-container">
                  {getStepIcon(step.type, step.icon, step.title)}
                </div>

                <div className="agent-trace-content">
                  <div className="agent-trace-title-container">
                    <h4
                      className={`agent-trace-title ${
                        step.status === "running"
                          ? "shimmer-text-active"
                          : hoveredStep === step.id
                            ? "shimmer-text"
                            : "text-gray-900"
                      }`}
                    >
                      {step.title}
                    </h4>
                  </div>

                  {step.description && (
                    <p
                      className={`agent-trace-description shimmer-text ${
                        step.status === "running" || hoveredStep === step.id ? "text-gray-800" : "text-gray-700"
                      }`}
                    >
                      {step.description}
                    </p>
                  )}

                  {step.files && step.files.length > 0 && (
                    <div className="agent-trace-files">
                      {step.files.map((file, fileIndex) => (
                        <div
                          key={fileIndex}
                          className={`agent-trace-file ${
                            hoveredStep === step.id
                              ? "bg-blue-50 border-blue-200 text-blue-800"
                              : "agent-trace-file-normal border-gray-200"
                          }`}
                        >
                          {getFileIcon(file)}
                          {file}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Si está colapsado, mostrar el accordion
  return (
    <div className="thinking-collapse">
      {/* Header del collapse - siempre visible */}
      <div 
        className="thinking-collapse-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="thinking-collapse-icon">
          <BrainCircuit className="thinking-collapse-brain" size={20} />
        </div>
        
        <div className="thinking-collapse-chevron">
          {isExpanded ? 
            <ChevronUp size={16} className="text-gray-500" /> : 
            <ChevronDown size={16} className="text-gray-500" />
          }
        </div>
      </div>

      {/* Contenido del collapse - solo visible cuando está expandido */}
      {isExpanded && (
        <div className="thinking-collapse-content">
          <div className="agent-trace-container">
            <div className="agent-trace-relative">
              <div className="agent-trace-line"></div>

              <div className="agent-trace-steps">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="agent-trace-step interactive-step"
                    onMouseEnter={() => setHoveredStep(step.id)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    <div className="agent-trace-icon-container">
                      {getStepIcon(step.type, step.icon, step.title)}
                    </div>

                    <div className="agent-trace-content">
                      <div className="agent-trace-title-container">
                        <h4
                          className={`agent-trace-title ${
                            step.status === "running"
                              ? "shimmer-text-active"
                              : hoveredStep === step.id
                                ? "shimmer-text"
                                : "text-gray-900"
                          }`}
                        >
                          {step.title}
                        </h4>
                      </div>

                      {step.description && (
                        <p
                          className={`agent-trace-description shimmer-text ${
                            step.status === "running" || hoveredStep === step.id ? "text-gray-800" : "text-gray-700"
                          }`}
                        >
                          {step.description}
                        </p>
                      )}

                      {step.files && step.files.length > 0 && (
                        <div className="agent-trace-files">
                          {step.files.map((file, fileIndex) => (
                            <div
                              key={fileIndex}
                              className={`agent-trace-file ${
                                hoveredStep === step.id
                                  ? "bg-blue-50 border-blue-200 text-blue-800"
                                  : "agent-trace-file-normal border-gray-200"
                              }`}
                            >
                              {getFileIcon(file)}
                              {file}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
