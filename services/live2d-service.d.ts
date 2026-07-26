interface Live2dFileReferences {
    Moc?: string;
    Physics?: string;
    Pose?: string;
    DisplayInfo?: string;
    Textures?: string[];
    Expressions?: Array<{
        File?: string;
    } | null | undefined>;
    Motions?: Record<string, Array<{
        File?: string;
        Sound?: string;
    } | null | undefined> | undefined>;
}
interface Live2dManifest {
    FileReferences?: Live2dFileReferences;
}
interface ModelInspection {
    available: boolean;
    modelUrl: string;
    source: string;
    missing: string[];
    canvas?: {
        width: number;
        height: number;
    };
}
interface Live2dServiceOptions {
    rootDir: string;
    characters?: string[];
}
interface Live2dStatus {
    available: boolean;
    characters: string[];
    models: Record<string, ModelInspection>;
}
declare function collectReferences(manifest: Live2dManifest | null | undefined): string[];
declare function inspectModel(rootDir: string, character: string): ModelInspection;
declare function createLive2dService(options: Live2dServiceOptions): {
    status: () => Live2dStatus;
};
declare const _default: {
    createLive2dService: typeof createLive2dService;
    inspectModel: typeof inspectModel;
    collectReferences: typeof collectReferences;
};
export = _default;
