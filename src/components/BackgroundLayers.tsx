import type { CSSProperties } from 'react'

interface BackgroundLayersProps {
  imageStyle?: CSSProperties
}

export function BackgroundLayers({ imageStyle }: BackgroundLayersProps): JSX.Element {
  return (
    <>
      <div className="background-gradient-layer" aria-hidden="true" />
      {imageStyle ? <div className="background-image-layer" style={imageStyle} aria-hidden="true" /> : null}
    </>
  )
}

