import NesRunner from './nesRunner.js';
import { ab2str } from './utils.js';

class Main {
    constructor() {
        wx.cloud.init({
            env: 'cloud1-5gxazrxk9ec80ff5',
            traceUser: true,
        });
        // 获取设备宽高
        const systemInfo = wx.getSystemInfoSync();
        this.canvasWidth = systemInfo.windowWidth;
        this.canvasHeight = systemInfo.windowHeight;
        // 创建全屏canvas
        this.canvas = wx.createCanvas();
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx = this.canvas.getContext('2d');
        this.mode = 0;
        this.server = null;
        this.nesRunner = null;
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.init();
    }

    init() {
        this.uiButtons = [];
        this.uiState = null;
        this.showModeUI();
    }

    showModeUI() {
        this.uiState = 'mode';
        const w = 220;
        const h = 60;
        const cx = this.canvasWidth / 2 - w / 2;
        const cy = this.canvasHeight / 2;
        this.uiButtons = [
            {
                text: '单人模式',
                x: cx,
                y: cy - 80,
                w,
                h,
                onTap: () => this.startSingleMode(),
            },
            {
                text: '双人模式',
                x: cx,
                y: cy + 10,
                w,
                h,
                onTap: () => this.showNetworkUI(),
            },
        ];
        this.drawUI('选择模式', true);
        wx.onTouchStart(this.handleUITouchStart.bind(this));
    }

    startSingleMode() {
        this.mode = 0;
        this.loadRomAndStart();
    }

    async setupServer() {
        if (!this.server) {
            this.server = wx.getGameServerManager();
        }
        await this.server.login();
        this.server.onBroadcast(() => {});
        this.server.onRoomInfoChange(() => console.log('房间信息变化'));
        this.server.onGameStart(() => {
            wx.hideLoading();
            this.loadRomAndStart();
        });
        this.server.onGameEnd(() => console.log('游戏结束'));
    }

    showNetworkUI() {
        this.mode = 1;
        const w = 220;
        const h = 60;
        const cx = this.canvasWidth / 2 - w / 2;
        const cy = this.canvasHeight / 2;
        this.uiState = 'network';
        this.uiButtons = [
            {
                text: '创建房间',
                x: cx,
                y: cy - 80,
                w,
                h,
                onTap: () => this.createRoom(),
            },
            {
                text: '加入房间',
                x: cx,
                y: cy + 10,
                w,
                h,
                onTap: () => this.showJoinRoomUI(),
            },
        ];
        this.setupServer().then(() => {
            this.drawUI('联机模式');
        });
    }

    createRoom() {
        this.setupServer().then(() => {
            this.server.createRoom({
                maxMemberNum: 2,
                startPercent: 0,
                needUserInfo: false,
            }).then(res => {
                console.log('房间号:', res.data.accessInfo);
                this.showRoomInfo(res.data.accessInfo);
            }).catch(console.error);
        }).catch(console.error);
    }

    showRoomInfo(roomId) {
        this.uiState = 'roomInfo';
        const w = 160;
        const h = 50;
        const cx = this.canvasWidth / 2 - w / 2;
        const cy = this.canvasHeight / 2;
        this.roomId = roomId;
        this.uiButtons = [
            {
                text: '复制房间号',
                x: cx,
                y: cy + 40,
                w,
                h,
                onTap: () => {
                    wx.setClipboardData({ data: this.roomId });
                    wx.showToast({ title: '已复制', icon: 'none', duration: 800 });
                },
            },
            {
                text: '开始游戏',
                x: cx,
                y: cy + 110,
                w,
                h,
                onTap: () => {
                    this.server.startGame();
                },
            },
        ];
        this.drawUI('房间号: ' + roomId);
    }

    showJoinRoomUI() {
        this.uiState = 'joinInput';
        this.inputRoomId = '';
        const w = 200;
        const h = 50;
        const cx = this.canvasWidth / 2 - w / 2;
        const cy = this.canvasHeight / 2;
        this.uiButtons = [
            {
                text: '加入',
                x: cx,
                y: cy + 40,
                w,
                h,
                onTap: () => this.joinRoom(),
            },
        ];
        wx.showKeyboard({ defaultValue: '', multiple: false });
        wx.onKeyboardInput(res => {
            this.inputRoomId = res.value;
            this.drawUI('输入房间号: ' + this.inputRoomId);
        });
        wx.onKeyboardConfirm(() => {
            wx.hideKeyboard();
            this.joinRoom();
        });
        this.drawUI('输入房间号:');
    }

    joinRoom() {
        const roomId = this.inputRoomId;
        if (!roomId) return;
        this.setupServer().then(() => {
            this.server.joinRoom({
                accessInfo: roomId,
            }).then(() => {
                wx.showLoading({ title: '等待房主开始...', mask: true });
            }).catch(console.error);
        }).catch(console.error);
    }

    drawUI(title, decor = false) {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.ctx.fillStyle = '#000000';
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.ctx.globalAlpha = 1;
        if (decor) {
            const cx = this.canvasWidth / 2;
            this.ctx.fillStyle = '#aaaaaa';
            this.ctx.fillRect(cx - 80, this.canvasHeight / 2 - 190, 160, 80);
            this.ctx.fillStyle = '#cc0000';
            this.ctx.fillRect(cx - 60, this.canvasHeight / 2 - 180, 120, 20);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(cx - 100, this.canvasHeight / 2 - 210, 20, 20);
            this.ctx.fillRect(cx + 80, this.canvasHeight / 2 - 210, 20, 20);
        }
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.font = '24px sans-serif';
        this.ctx.fillText(title, this.canvasWidth / 2, this.canvasHeight / 2 - 120);
        for (const b of this.uiButtons) {
            this.ctx.fillStyle = '#222222';
            this.ctx.fillRect(b.x, b.y, b.w, b.h);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2 + 8);
        }
    }

    handleUITouchStart(e) {
        if (!this.uiButtons) return;
        const touch = e.touches[0];
        if (!touch) return;
        const x = touch.x !== undefined ? touch.x : touch.clientX;
        const y = touch.y !== undefined ? touch.y : touch.clientY;
        for (const b of this.uiButtons) {
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                if (b.onTap) b.onTap();
                break;
            }
        }
    }

    loadRomAndStart() {
        wx.showLoading({ title: '资源下载中', mask: true });
        wx.cloud.downloadFile({
            fileID: 'cloud://cloud1-5gxazrxk9ec80ff5.636c-cloud1-5gxazrxk9ec80ff5-1366451675/魂斗罗kc版.nes',
            success: res => {
                const fs = wx.getFileSystemManager();
                fs.readFile({
                    filePath: res.tempFilePath,
                    success: readRes => {
                        const romData = ab2str(readRes.data);
                        wx.hideLoading();
                        this.nesRunner = new NesRunner({
                            ctx: this.ctx,
                            width: this.canvasWidth,
                            height: this.canvasHeight,
                            mode: this.mode,
                            server: this.server
                        });
                        this.nesRunner.start(romData);
                    },
                });
            },
            fail: console.error,
        });
    }



}

export default Main;
