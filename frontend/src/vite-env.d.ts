/// <reference types="vite/client" />

declare module "react-simple-maps" {
  import { ComponentType, CSSProperties, MouseEvent } from "react";

  interface ProjectionConfig { rotate?: [number, number, number]; center?: [number, number]; scale?: number; }
  interface ComposableMapProps { projection?: string; projectionConfig?: ProjectionConfig; width?: number; height?: number; style?: CSSProperties; children?: React.ReactNode; }
  interface Geo { rsmKey: string; id: string | number; properties: Record<string, unknown>; type: string; geometry: Record<string, unknown>; }
  interface GeographyStyle { fill?: string; stroke?: string; strokeWidth?: number; outline?: string; cursor?: string; transition?: string; }
  interface GeographyProps {
    geography: Geo;
    style?: { default?: GeographyStyle; hover?: GeographyStyle; pressed?: GeographyStyle };
    onClick?: (evt: MouseEvent<SVGPathElement>) => void;
    onMouseEnter?: (evt: MouseEvent<SVGPathElement>) => void;
    onMouseMove?: (evt: MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (evt: MouseEvent<SVGPathElement>) => void;
  }
  interface GeographiesProps { geography: string | object; children: (p: { geographies: Geo[] }) => React.ReactNode; }

  interface MarkerProps { coordinates: [number, number]; children?: React.ReactNode; }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const Marker: ComponentType<MarkerProps>;
}
