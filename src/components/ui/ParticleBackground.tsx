import React, { useEffect, useRef } from 'react';

const PARTICLE_COLOR = 'rgba(59, 130, 246, 0.1)'; // #3B82F6 with 0.1 opacity
const PARTICLE_COLOR_ALT = 'rgba(59, 130, 246, 0.07)';
const PARTICLE_COLOR_ALT2 = 'rgba(59, 130, 246, 0.15)';
const PARTICLE_MIN_SIZE = 2;
const PARTICLE_MAX_SIZE = 8;
const PARTICLE_LAYERS = 3;
const PARTICLE_COUNT_DESKTOP = 28;
const PARTICLE_COUNT_MOBILE = 12;

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function getColorByLayer(layer: number) {
  if (layer === 0) return PARTICLE_COLOR;
  if (layer === 1) return PARTICLE_COLOR_ALT;
  return PARTICLE_COLOR_ALT2;
}

export const ParticleBackground: React.FC = () => {
  const isMobile = window.innerWidth < 640;
  const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
  const particles = Array.from({ length: particleCount }).map((_, i) => {
    const layer = i % PARTICLE_LAYERS;
    const size = randomBetween(PARTICLE_MIN_SIZE, PARTICLE_MAX_SIZE);
    const left = randomBetween(0, 100);
    const top = randomBetween(0, 100);
    const duration = randomBetween(6, 12);
    const delay = randomBetween(0, 6);
    const color = getColorByLayer(layer);
    const zIndex = -1 - layer;
    return (
      <div
        key={i}
        className="particle"
        style={{
          width: size,
          height: size,
          left: `${left}%`,
          top: `${top}%`,
          background: color,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
          zIndex,
          opacity: 1,
        }}
      />
    );
  });

  return <div className="particle-container">{particles}</div>;
}; 