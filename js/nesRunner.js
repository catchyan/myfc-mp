import { NES, Controller } from './libs/jsnes.min.js';
import { isInBtn, getDirections } from './utils.js';

export default class NesRunner {
  constructor({ ctx, width, height, mode = 0, server = null }) {
    this.ctx = ctx;
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.mode = mode; // 0: single, 1: network
    this.server = server;
    this.nes = null;
    this.syncTimer = null;
  }

  start(romData) {
    // 创建离屏canvas
    const offscreen = wx.createCanvas({ type: '2d', width: 256, height: 240 });
    const offCtx = offscreen.getContext('2d');
    const imageData = offCtx.createImageData(256, 240);

    this.nes = new NES({
      onFrame: (frameBuffer) => {
        for (let i = 0; i < frameBuffer.length; i++) {
          const color = frameBuffer[i];
          imageData.data[i * 4 + 0] = color & 0xFF;
          imageData.data[i * 4 + 1] = (color >> 8) & 0xFF;
          imageData.data[i * 4 + 2] = (color >> 16) & 0xFF;
          imageData.data[i * 4 + 3] = 0xFF;
        }
        offCtx.putImageData(imageData, 0, 0);

        const scale = Math.min(this.canvasWidth / 256, this.canvasHeight / 240);
        const drawWidth = 256 * scale;
        const drawHeight = 240 * scale;
        const offsetX = Math.floor((this.canvasWidth - drawWidth) / 2);
        const offsetY = Math.floor((this.canvasHeight - drawHeight) / 2);
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.ctx.drawImage(offscreen, 0, 0, 256, 240, offsetX, offsetY, drawWidth, drawHeight);

        if (this.mode === 1 && this.server && this.server.getRoomInfo) {
          const info = this.server.getRoomInfo() || {};
          const members = info.memberList || [];
          const boxH = members.length * 16 + 8;
          this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
          this.ctx.fillRect(4, 4, 72, boxH);
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = '10px sans-serif';
          members.forEach((m, idx) => {
            this.ctx.fillText(`P${idx + 1}:在线`, 8, 16 + idx * 16);
          });
        }
      },
      onAudioSample: () => {},
    });

    this.nes.loadROM(romData);

    this.localInput = {};
    this.frameInputs = {};
    this.frameId = 0;
    this.playerIdx = 1;
    const is2P = this.mode === 1;

    this.setupControls();
    if (!is2P) {
      this.startSinglePlayer();
    } else {
      this.startMultiplayer();
    }
  }

  setupControls() {
    const dpadSize = 120;
    const margin = 0.05;
    const dpadX = this.canvasWidth * margin + dpadSize / 2;
    const dpadY = this.canvasHeight - this.canvasHeight * margin - dpadSize / 2;

    const btnRadius = 40;
    const btnGap = 20;
    const btnA_X = this.canvasWidth - btnRadius - 50;
    const btnA_Y = this.canvasHeight - btnRadius - 100;
    const btnB_X = btnA_X - btnRadius * 2 - btnGap;
    const btnB_Y = btnA_Y + btnRadius;

    const startRadius = 32;
    const startGap = 20;
    const select_X = this.canvasWidth - startRadius - 150;
    const select_Y = startRadius + 30;
    const start_X = select_X;
    const start_Y = select_Y + startRadius * 2 + startGap;

    const dpadImg = wx.createImage();
    dpadImg.src = 'images/gamecube_dpad_none.png';
    dpadImg.onload = () => {
      this.ctx.drawImage(dpadImg, dpadX - dpadSize / 2, dpadY - dpadSize / 2, dpadSize, dpadSize);
    };
    const btnAImg = wx.createImage();
    btnAImg.src = 'images/gamecube_button_a_outline.png';
    btnAImg.onload = () => {
      this.ctx.drawImage(btnAImg, btnA_X - btnRadius, btnA_Y - btnRadius, btnRadius * 2, btnRadius * 2);
      this.ctx.beginPath();
      this.ctx.arc(btnA_X, btnA_Y, btnRadius * 0.8, 0, 2 * Math.PI);
      this.ctx.strokeStyle = 'rgba(255,0,0,0.3)';
      this.ctx.stroke();
    };
    const btnBImg = wx.createImage();
    btnBImg.src = 'images/gamecube_button_b_outline.png';
    btnBImg.onload = () => {
      this.ctx.drawImage(btnBImg, btnB_X - btnRadius, btnB_Y - btnRadius, btnRadius * 2, btnRadius * 2);
      this.ctx.beginPath();
      this.ctx.arc(btnB_X, btnB_Y, btnRadius * 0.8, 0, 2 * Math.PI);
      this.ctx.strokeStyle = 'rgba(255,0,0,0.3)';
      this.ctx.stroke();
    };
    const startImg = wx.createImage();
    startImg.src = 'images/playstation3_button_start_outline.png';
    startImg.onload = () => {
      this.ctx.drawImage(startImg, start_X - startRadius, start_Y - startRadius, startRadius * 2, startRadius * 2);
    };
    const selectImg = wx.createImage();
    selectImg.src = 'images/playstation3_button_select_outline.png';
    selectImg.onload = () => {
      this.ctx.drawImage(selectImg, select_X - startRadius, select_Y - startRadius, startRadius * 2, startRadius * 2);
    };

    this.currentKeys = new Set();
    this.touchMap = {};

    const collectInput = () => {
      const input = {};
      for (const key of [
        'BUTTON_UP', 'BUTTON_DOWN', 'BUTTON_LEFT', 'BUTTON_RIGHT',
        'BUTTON_A', 'BUTTON_B', 'BUTTON_START', 'BUTTON_SELECT']) {
        input[key] = this.currentKeys.has(key) ? 1 : 0;
      }
      return input;
    };
    this.collectInput = collectInput;

    wx.onTouchStart((e) => {
      for (const touch of e.touches) {
        let x = touch.x !== undefined ? touch.x : touch.clientX;
        let y = touch.y !== undefined ? touch.y : touch.clientY;
        let keys = [];
        const dirs = getDirections(x, y, dpadX, dpadY, dpadSize);
        for (const dir of dirs) {
          keys.push('BUTTON_' + dir);
        }
        if (isInBtn(x, y, btnA_X, btnA_Y, btnRadius)) keys.push('BUTTON_A');
        if (isInBtn(x, y, btnB_X, btnB_Y, btnRadius)) keys.push('BUTTON_B');
        if (isInBtn(x, y, start_X, start_Y, startRadius)) keys.push('BUTTON_START');
        if (isInBtn(x, y, select_X, select_Y, startRadius)) keys.push('BUTTON_SELECT');
        if (keys.length && !this.touchMap[touch.identifier]) {
          for (const key of keys) {
            this.currentKeys.add(key);
          }
          this.touchMap[touch.identifier] = keys;
        }
      }
    });

    wx.onTouchMove((e) => {
      for (const touch of e.touches) {
        let x = touch.x !== undefined ? touch.x : touch.clientX;
        let y = touch.y !== undefined ? touch.y : touch.clientY;
        let newKeys = [];
        const dirs = getDirections(x, y, dpadX, dpadY, dpadSize);
        for (const dir of dirs) {
          newKeys.push('BUTTON_' + dir);
        }
        if (isInBtn(x, y, btnA_X, btnA_Y, btnRadius)) newKeys.push('BUTTON_A');
        if (isInBtn(x, y, btnB_X, btnB_Y, btnRadius)) newKeys.push('BUTTON_B');
        if (isInBtn(x, y, start_X, start_Y, startRadius)) newKeys.push('BUTTON_START');
        if (isInBtn(x, y, select_X, select_Y, startRadius)) newKeys.push('BUTTON_SELECT');
        const oldKeys = this.touchMap[touch.identifier] || [];
        for (const key of oldKeys) {
          if (!newKeys.includes(key)) {
            this.currentKeys.delete(key);
          }
        }
        for (const key of newKeys) {
          if (!oldKeys.includes(key)) {
            this.currentKeys.add(key);
          }
        }
        this.touchMap[touch.identifier] = newKeys;
      }
    });

    wx.onTouchEnd((e) => {
      for (const touch of e.changedTouches) {
        const keys = this.touchMap[touch.identifier];
        if (keys) {
          for (const key of keys) {
            this.currentKeys.delete(key);
          }
          delete this.touchMap[touch.identifier];
        }
      }
    });
  }

  startSinglePlayer() {
    const runFrame = () => {
      const input = this.collectInput();
      for (const key in input) {
        if (input[key]) {
          this.nes.buttonDown(1, Controller[key]);
        } else {
          this.nes.buttonUp(1, Controller[key]);
        }
      }
      this.nes.frame();
      requestAnimationFrame(runFrame);
    };
    runFrame();
  }

  startMultiplayer() {
    if (this.server && this.server.getRoomInfo) {
      const info = this.server.getRoomInfo();
      if (info && info.memberList) {
        const openidList = info.memberList.map(m => m.openId);
        const myOpenid = wx.getOpenDataContext ? wx.getOpenDataContext().openid : '';
        this.playerIdx = openidList.indexOf(myOpenid) + 1;
      }
    }

    this.server.onSyncFrame((res) => {
      const frameInputs = [null, null, null];
      const info = this.server.getRoomInfo && this.server.getRoomInfo();
      let openidList = info && info.memberList ? info.memberList.map(m => m.openId) : [];
      if (Array.isArray(res.frameDataList)) {
        res.frameDataList.forEach(fd => {
          const idx = openidList.indexOf(fd.openId) + 1;
          if (idx === 1 || idx === 2) {
            frameInputs[idx] = fd.data.input;
          }
        });
      }
      for (let p = 1; p <= 2; ++p) {
        const input = frameInputs[p] || {};
        for (const key of [
          'BUTTON_UP','BUTTON_DOWN','BUTTON_LEFT','BUTTON_RIGHT',
          'BUTTON_A','BUTTON_B','BUTTON_START','BUTTON_SELECT']) {
          if (input[key]) {
            this.nes.buttonDown(p, Controller[key]);
          } else {
            this.nes.buttonUp(p, Controller[key]);
          }
        }
      }
      this.nes.frame();
      this.frameId++;
    });

    this.syncTimer = setInterval(() => {
      const input = this.collectInput();
      this.server.uploadFrame({
        data: {
          input,
          frameId: this.frameId
        }
      });
    }, 1000 / 60);
  }
}
