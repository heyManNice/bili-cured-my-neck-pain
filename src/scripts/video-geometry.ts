export interface Point {
    x: number;
    y: number;
}

export interface VideoGeometryInput {
    contentWidth: number;
    contentHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    angle: number;
    userScale: number;
}

export interface VideoGeometry extends VideoGeometryInput {
    radians: number;
    cos: number;
    sin: number;
    coverScale: number;
    scale: number;
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

    // 将播放器四角逆旋转到视频坐标系，确保 100% 时视频完整覆盖播放器。
    const coverScale = Math.max(
        (viewportWidth * absCos + viewportHeight * absSin) / contentWidth,
        (viewportWidth * absSin + viewportHeight * absCos) / contentHeight,
    );
    const scale = coverScale * Math.max(0.01, input.userScale);

    return {
        ...input,
        contentWidth,
        contentHeight,
        viewportWidth,
        viewportHeight,
        radians,
        cos,
        sin,
        coverScale,
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
