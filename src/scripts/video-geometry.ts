export interface Point {
    x: number;
    y: number;
}

export interface VideoGeometryInput {
    readonly contentWidth: number;
    readonly contentHeight: number;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
    readonly angle: number;
    readonly userScale: number;
    readonly videoWidth?: number;
    readonly videoHeight?: number;
}

export interface VideoGeometry extends Omit<VideoGeometryInput, 'videoWidth' | 'videoHeight'> {
    readonly videoWidth: number;
    readonly videoHeight: number;
    readonly radians: number;
    readonly cos: number;
    readonly sin: number;
    readonly frameWidth: number;
    readonly frameHeight: number;
    readonly fitScale: number;
    readonly scale: number;
}

const EPSILON = 1e-7;

export function calculateVideoGeometry(input: VideoGeometryInput): VideoGeometry {
    const contentWidth = Math.max(EPSILON, input.contentWidth);
    const contentHeight = Math.max(EPSILON, input.contentHeight);
    const viewportWidth = Math.max(EPSILON, input.viewportWidth);
    const viewportHeight = Math.max(EPSILON, input.viewportHeight);
    const radians = input.angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const absCos = Math.abs(cos);
    const absSin = Math.abs(sin);
    const videoWidth = Math.max(EPSILON, input.videoWidth ?? contentWidth);
    const videoHeight = Math.max(EPSILON, input.videoHeight ?? contentHeight);
    const frameScale = Math.min(contentWidth / videoWidth, contentHeight / videoHeight);
    const frameWidth = videoWidth * frameScale;
    const frameHeight = videoHeight * frameScale;

    // At 100%, fit the rotated video frame inside the player viewport.
    const fitScale = Math.min(
        viewportWidth / (frameWidth * absCos + frameHeight * absSin),
        viewportHeight / (frameWidth * absSin + frameHeight * absCos),
    );
    const scale = fitScale * Math.max(0.01, input.userScale);

    return {
        ...input,
        contentWidth,
        contentHeight,
        viewportWidth,
        viewportHeight,
        videoWidth,
        videoHeight,
        radians,
        cos,
        sin,
        frameWidth,
        frameHeight,
        fitScale,
        scale,
    };
}

export function viewCenterToTranslation(center: Point, geometry: VideoGeometry): Point {
    return {
        x: -geometry.scale * (center.x * geometry.cos - center.y * geometry.sin),
        y: -geometry.scale * (center.x * geometry.sin + center.y * geometry.cos),
    };
}

export function screenPointToContent(point: Point, translation: Point, geometry: VideoGeometry): Point {
    const x = point.x - translation.x;
    const y = point.y - translation.y;
    return {
        x: (x * geometry.cos + y * geometry.sin) / geometry.scale,
        y: (-x * geometry.sin + y * geometry.cos) / geometry.scale,
    };
}

export function getVisiblePolygon(geometry: VideoGeometry, center: Point): Point[] {
    const translation = viewCenterToTranslation(center, geometry);
    const halfWidth = geometry.viewportWidth / 2;
    const halfHeight = geometry.viewportHeight / 2;
    return [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight },
    ].map(point => screenPointToContent(point, translation, geometry));
}

export function contentPointToMinimap(
    point: Point,
    geometry: Pick<VideoGeometry, 'contentWidth' | 'contentHeight'>,
    minimapWidth: number,
    minimapHeight: number,
): Point {
    return {
        x: (point.x / geometry.contentWidth + 0.5) * minimapWidth,
        y: (point.y / geometry.contentHeight + 0.5) * minimapHeight,
    };
}

export function minimapPointToContent(
    point: Point,
    geometry: Pick<VideoGeometry, 'contentWidth' | 'contentHeight'>,
    minimapWidth: number,
    minimapHeight: number,
): Point {
    return {
        x: (point.x / minimapWidth - 0.5) * geometry.contentWidth,
        y: (point.y / minimapHeight - 0.5) * geometry.contentHeight,
    };
}
