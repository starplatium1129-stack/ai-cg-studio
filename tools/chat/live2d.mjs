import { LIVE2D_EXPRESSIONS } from './config.mjs';

function errorText(error) {
  return String(error && error.message || error || '未知错误');
}

export class Live2DController {
  constructor(options) {
    this.host = options.host;
    this.stage = options.stage;
    this.onStatus = options.onStatus || (() => {});
    this.character = 'nene';
    this.catalog = null;
    this.app = null;
    this.model = null;
    this.loadedCharacter = '';
    this.ready = false;
    this.loading = null;
    this.loadTimer = 0;
    this.resizeObserver = null;
    this.destroyed = false;
  }

  setState(state, text, detail = '', retryable = false) {
    this.host.dataset.state = state;
    this.host.dataset.error = detail;
    this.host.dataset.retryable = retryable ? 'true' : 'false';
    this.onStatus({ state, text, detail, retryable, ready:this.ready });
  }

  async init(character) {
    this.character = character || this.character;
    this.setState('checking', '检查 Live2D…');
    try {
      const response = await fetch('/api/live2d-status', { cache:'no-store' });
      if (!response.ok) throw new Error('Live2D 状态接口不可用');
      this.catalog = await response.json();
      this.observeSize();
      await this.setCharacter(this.character);
    } catch (error) {
      this.fallback('Live2D 未就绪', errorText(error));
    }
  }

  modelInfo(character) {
    return this.catalog && this.catalog.models && this.catalog.models[character] || null;
  }

  async setCharacter(character) {
    this.character = character;
    const info = this.modelInfo(character);
    if (!info || !info.available || !info.modelUrl) {
      this.setVisible(false);
      this.setState('static', '静态立绘', info && info.source || '该角色暂无 Live2D 模型');
      return;
    }
    if (this.ready && this.loadedCharacter === character) {
      this.setVisible(true);
      this.setState('ready', 'Live2D 已连接');
      this.layout();
      return;
    }
    await this.load(character, info);
  }

  async retry() {
    if (this.destroyed) return;
    this.destroyRuntime();
    await this.setCharacter(this.character);
  }

  load(character, info) {
    if (this.loading) return this.loading;
    this.loading = new Promise((resolve) => {
      const library = window['wl-live2d'];
      if (!library || typeof library.wlLive2d !== 'function') {
        const bootstrapErrors = (window.__live2dBootstrapErrors || []).join(' | ');
        this.fallback('Live2D 运行库加载失败', bootstrapErrors || 'wl-live2d global missing');
        resolve(false);
        return;
      }

      this.destroyRuntime();
      this.host.innerHTML = '';
      this.setState('loading', 'Live2D 加载中…');
      const canvas = info.canvas || { width:420, height:610 };
      let settled = false;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(this.loadTimer);
        this.loading = null;
        resolve(value);
      };

      this.loadTimer = window.setTimeout(() => {
        this.fallback('Live2D 加载超时', '模型在 20 秒内没有完成初始化');
        finish(false);
      }, 20000);

      try {
        this.app = library.wlLive2d({
          selector: '#live2dHost',
          fixed: false,
          drag: false,
          sayHello: false,
          hitFrame: false,
          menus: [],
          tips: {
            talk: false,
            drag: false,
            motionMessage: false,
            message: [],
            talkApis: []
          },
          transitionTime: 250,
          models: [{
            path: info.modelUrl,
            width: canvas.width,
            height: canvas.height,
            position: { x:0, y:0 },
            motionPreload: 'IDLE'
          }]
        });
        this.app.onModelLoaded((model) => {
          if (this.destroyed || character !== this.character) {
            finish(false);
            return;
          }
          this.model = model;
          this.loadedCharacter = character;
          this.ready = true;
          this.bindContextEvents();
          this.fit();
          this.layout();
          this.setVisible(true);
          this.setState('ready', 'Live2D 已连接');
          finish(true);
        });
        this.app.onModelError((error) => {
          this.fallback('Live2D 模型加载失败', errorText(error));
          finish(false);
        });
      } catch (error) {
        this.fallback('Live2D 初始化失败', errorText(error));
        finish(false);
      }
    });
    return this.loading;
  }

  observeSize() {
    if ('ResizeObserver' in window && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.layout());
      this.resizeObserver.observe(this.host);
    } else {
      window.addEventListener('resize', this.onResize = () => this.layout());
    }
  }

  bindContextEvents() {
    const canvas = this.host.querySelector('canvas');
    if (!canvas || canvas.dataset.contextEvents === '1') return;
    canvas.dataset.contextEvents = '1';
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.fallback('Live2D 图形上下文已暂停', 'WebGL context lost');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.retry();
    });
  }

  fit() {
    if (!this.model) return;
    try {
      const canvas = this.host.querySelector('canvas');
      const stageWidth = canvas && (parseFloat(canvas.style.width) || canvas.width) || 420;
      const stageHeight = canvas && (parseFloat(canvas.style.height) || canvas.height) || 610;
      const scaleX = this.model.scale && this.model.scale.x || 1;
      const scaleY = this.model.scale && this.model.scale.y || 1;
      const naturalWidth = this.model.width / scaleX;
      const naturalHeight = this.model.height / scaleY;
      if (!naturalWidth || !naturalHeight) return;
      const scale = Math.min(stageWidth / naturalWidth, stageHeight / naturalHeight) * 0.99;
      this.model.scale.set(scale);
      this.model.x = (stageWidth - naturalWidth * scale) / 2;
      this.model.y = stageHeight - naturalHeight * scale;
    } catch (error) {
      this.fallback('Live2D 布局失败', errorText(error));
    }
  }

  layout() {
    if (!this.ready) return;
    try {
      const wrapper = this.host.firstElementChild;
      if (!wrapper) return;
      const widthScale = this.host.clientWidth / 420;
      const heightScale = this.host.clientHeight / 610;
      // The model texture includes generous transparent margins. A restrained
      // cover-style scale keeps the character readable without cropping the face.
      const scale = Math.max(widthScale, heightScale) * 1.15;
      wrapper.style.transform = `translateX(-50%) scale(${Math.min(1.1, scale > 0 ? scale : 1)})`;
      this.fit();
    } catch (error) {}
  }

  setVisible(value) {
    const visible = Boolean(value && this.ready && this.loadedCharacter === this.character);
    this.stage.classList.toggle('live2d-ready', visible);
    if (this.model) this.model.visible = visible;
  }

  setExpression(emotion) {
    if (!this.ready || !this.model || !this.model.visible) return;
    const name = LIVE2D_EXPRESSIONS[emotion] || LIVE2D_EXPRESSIONS.neutral;
    try {
      if (typeof this.model.expression === 'function') this.model.expression(name);
    } catch (error) {}
  }

  setMouth(value) {
    if (!this.ready || !this.model || !this.model.visible) return;
    try {
      this.model.internalModel.coreModel.setParameterValueById(
        'ParamMouthOpenY',
        Math.max(0, Math.min(1, Number(value) || 0))
      );
    } catch (error) {}
  }

  fallback(text, detail) {
    this.ready = false;
    this.setVisible(false);
    this.setState('fallback', text || '静态立绘', detail || '', true);
  }

  destroyRuntime() {
    clearTimeout(this.loadTimer);
    this.loadTimer = 0;
    this.ready = false;
    this.model = null;
    this.loadedCharacter = '';
    this.stage.classList.remove('live2d-ready');
    if (this.app && typeof this.app.destroy === 'function') {
      try { this.app.destroy(); } catch (error) {}
    }
    this.app = null;
    this.host.innerHTML = '';
  }

  destroy() {
    this.destroyed = true;
    this.destroyRuntime();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.onResize) window.removeEventListener('resize', this.onResize);
  }
}
