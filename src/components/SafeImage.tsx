import React, { useState } from 'react';
import { SAMPLE_GRAIN_IMAGES } from '../constants.js';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

/**
 * Image with a guaranteed fallback. Remote CDN photos can expire or fail on
 * flaky field networks — the UI must never show a broken-image icon on stage.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  fallbackSrc = SAMPLE_GRAIN_IMAGES.wheat_pile,
  alt = '',
  ...rest
}) => {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={src && !failed ? src : fallbackSrc}
      alt={alt}
      onError={() => {
        if (!failed) setFailed(true);
      }}
      {...rest}
    />
  );
};
