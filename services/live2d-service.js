'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function safeReference(modelDir, reference) {
    if (!reference || typeof reference !== 'string')
        return '';
    const resolved = path.resolve(modelDir, reference);
    const root = path.resolve(modelDir) + path.sep;
    return resolved.startsWith(root) ? resolved : '';
}
function collectReferences(manifest) {
    const refs = [];
    const files = (manifest && manifest.FileReferences) || {};
    ['Moc', 'Physics', 'Pose', 'DisplayInfo'].forEach(function (key) {
        const value = files[key];
        if (value)
            refs.push(value);
    });
    (files.Textures || []).forEach(function (item) {
        refs.push(item);
    });
    (files.Expressions || []).forEach(function (item) {
        if (item && item.File)
            refs.push(item.File);
    });
    Object.keys(files.Motions || {}).forEach(function (group) {
        const motions = (files.Motions && files.Motions[group]) || [];
        motions.forEach(function (item) {
            if (item && item.File)
                refs.push(item.File);
            if (item && item.Sound)
                refs.push(item.Sound);
        });
    });
    return refs;
}
function inspectModel(rootDir, character) {
    const modelDir = path.join(rootDir, character);
    const manifestName = character + '.model3.json';
    const manifestPath = path.join(modelDir, manifestName);
    const result = {
        available: false,
        modelUrl: '',
        source: 'missing',
        missing: []
    };
    if (!fs.existsSync(manifestPath))
        return result;
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
    catch {
        result.source = 'invalid-manifest';
        result.missing = [manifestName];
        return result;
    }
    collectReferences(manifest).forEach(function (reference) {
        const target = safeReference(modelDir, reference);
        if (!target || !fs.existsSync(target))
            result.missing.push(reference);
    });
    result.available = result.missing.length === 0;
    result.modelUrl = result.available
        ? '/assets/live2d-current/' + encodeURIComponent(character) + '/' + manifestName
        : '';
    result.source = result.available ? 'project-local' : 'incomplete-model';
    result.canvas = { width: 420, height: 610 };
    return result;
}
function createLive2dService(options) {
    const rootDir = options.rootDir;
    const characters = options.characters || ['nene', 'natsume'];
    function status() {
        const models = {};
        characters.forEach(function (character) {
            models[character] = inspectModel(rootDir, character);
        });
        const availableCharacters = characters.filter(function (character) {
            return models[character].available;
        });
        return {
            available: availableCharacters.length > 0,
            characters: availableCharacters,
            models: models
        };
    }
    return { status: status };
}
module.exports = {
    createLive2dService: createLive2dService,
    inspectModel: inspectModel,
    collectReferences: collectReferences
};
