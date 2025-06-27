import { NES, Controller } from './libs/jsnes.min.js';

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
        this.nes = null;
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.init();
    }

    init() {
        // 模式选择Modal
        wx.showActionSheet({
            itemList: ['单人模式', '双人模式'],
            success: (res) => {
                this.mode = res.tapIndex;
                if (this.mode == 0) {
                    wx.showLoading({
                        title: '资源下载中',
                        mask: true
                    })
                    wx.cloud.downloadFile({
                        fileID: 'cloud://cloud1-5gxazrxk9ec80ff5.636c-cloud1-5gxazrxk9ec80ff5-1366451675/魂斗罗kc版.nes', // 文件 ID
                        success: res => {
                            const fs = wx.getFileSystemManager();
                            fs.readFile({
                                filePath: res.tempFilePath,
                                //   encoding: '', // 默认为 ArrayBuffer
                                success: (readRes) => {
                                    const romData = this.ab2str(readRes.data);
                                    wx.hideLoading();
                                    this.startNES(romData);
                                }
                            })
                        },
                        fail: console.error
                    })
                } else {
                    wx.showActionSheet({
                        itemList: ['创建房间', '加入房间'],
                        success: async (res) => {
                            this.server = wx.getGameServerManager();
                            await this.server.login();
                            this.server.onBroadcast(() => {
                                // 收到来自领一个玩家的操作信息
                            });
                            // this.server.onSyncFrame((res) => {
                            //     console.log(res);
                            //     if(this.nes) {
                            //         this.nes.frame();
                            //     }
                            // });
                            this.server.onRoomInfoChange(() => console.log('房间信息变化'));
                            this.server.onGameStart(()=>{
                                wx.showLoading({
                                    title: '资源下载中',
                                    mask: true
                                })
                                wx.cloud.downloadFile({
                                    fileID: 'cloud://cloud1-5gxazrxk9ec80ff5.636c-cloud1-5gxazrxk9ec80ff5-1366451675/魂斗罗kc版.nes', // 文件 ID
                                    success: res => {
                                        const fs = wx.getFileSystemManager();
                                        fs.readFile({
                                            filePath: res.tempFilePath,
                                            //   encoding: '', // 默认为 ArrayBuffer
                                            success: (readRes) => {
                                                const romData = this.ab2str(readRes.data);
                                                wx.hideLoading();
                                                this.startNES(romData);
                                            }
                                        })
                                    },
                                    fail: console.error
                                })
                            });
                            this.server.onGameEnd(() => console.log('游戏结束'));
                            if (res.tapIndex == 0) {
                                this.server.login().then(res => {
                                    this.server.createRoom({
                                        maxMemberNum: 2,
                                        startPercent: 0,
                                        needUserInfo: false,
                                    }).then(res => {
                                        console.log(res.data.accessInfo);
                                        wx.showModal({
                                            title: '房间号:',
                                            content: res.data.accessInfo,
                                            showCancel: false,
                                            confirmText: '复制',
                                            success: () => {
                                                console.log("复制" + res.data.accessInfo)
                                                wx.setClipboardData({
                                                    data: res.data.accessInfo,
                                                })
                                                wx.showLoading({
                                                    title: '等待其他玩家...',
                                                })
                                            }
                                        })
                                    }).catch(console.error);
                                }).catch(console.error);

                            } else {
                                wx.showModal({
                                    title: '输入房间号',
                                    editable: true,
                                    content: '',
                                    showCancel: false,
                                    confirmText: '加入',
                                    success: (roomIdRes) => {
                                        const roomId = roomIdRes.content;
                                        this.server.login().then(res => {
                                            this.server.joinRoom({
                                                accessInfo: roomId,
                                            }).then(res => {
                                                console.log(res);
                                                this.server.startGame();
                                                
                                            }).catch(console.error);
                                        }).catch(console.error);

                                    }
                                })
                            }
                        }
                    })
                }
            }
        })
    }

    ab2str(buf) {
        const uint8Arr = new Uint8Array(buf);
        let str = '';
        const chunkSize = 0x8000; // 32KB
        for (let i = 0; i < uint8Arr.length; i += chunkSize) {
            str += String.fromCharCode.apply(
                null,
                uint8Arr.subarray(i, i + chunkSize)
            );
        }
        return str;
    }

    startNES(romData) {
        // 清除画布
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        // 创建离屏canvas
        const offscreen = wx.createCanvas({ type: '2d', width: 256, height: 240 });
        const offCtx = offscreen.getContext('2d');
        const imageData = offCtx.createImageData(256, 240);

        this.nes = new NES({
            onFrame: (frameBuffer) => {
                for (let i = 0; i < frameBuffer.length; i++) {
                    const color = frameBuffer[i];
                    imageData.data[i * 4 + 0] = color & 0xFF;         // R
                    imageData.data[i * 4 + 1] = (color >> 8) & 0xFF;  // G
                    imageData.data[i * 4 + 2] = (color >> 16) & 0xFF; // B
                    imageData.data[i * 4 + 3] = 0xFF;                 // A
                }
                offCtx.putImageData(imageData, 0, 0);

                // 计算缩放和居中
                const scale = Math.min(this.canvasWidth / 256, this.canvasHeight / 240);
                const drawWidth = 256 * scale;
                const drawHeight = 240 * scale;
                const offsetX = Math.floor((this.canvasWidth - drawWidth) / 2);
                const offsetY = Math.floor((this.canvasHeight - drawHeight) / 2);

                // 清空主画布并绘制NES
                this.ctx.clearRect(offsetX, offsetY, drawWidth, drawHeight);
                this.ctx.drawImage(offscreen, 0, 0, 256, 240, offsetX, offsetY, drawWidth, drawHeight);
            },
            onAudioSample: (left, right) => {
                // 音频部分可后续补充
            }
        });

        this.nes.loadROM(romData);

        // ========== 帧同步相关变量 ==========
        // 记录每一帧本地采集的输入
        this.localInput = {};
        // 记录当前帧所有玩家输入
        this.frameInputs = {};
        // 当前帧号
        this.frameId = 0;
        // 玩家编号（1为主机/房主，2为客机/加入者）
        this.playerIdx = 1;
        // 是否为2P模式
        const is2P = this.mode === 1;
        // ========== END ==========

        const dpadSize = 120;
        const margin = 0.05;

        const dpadX = this.canvasWidth * margin + dpadSize / 2;
        const dpadY = this.canvasHeight - this.canvasHeight * margin - dpadSize / 2;

        // 按钮参数
        const btnRadius = 40;
        const btnGap = 20;
        const btnA_X = this.canvasWidth - btnRadius - 50;
        const btnA_Y = this.canvasHeight - btnRadius - 100;
        const btnB_X = btnA_X - btnRadius * 2 - btnGap;
        const btnB_Y = btnA_Y + btnRadius;

        // 右上角按钮参数
        const startRadius = 32;
        const startGap = 20;
        const select_X = this.canvasWidth - startRadius - 150;
        const select_Y = startRadius + 30;
        const start_X = select_X;
        const start_Y = select_Y + startRadius * 2 + startGap;

        // 加载图片
        const dpadImg = wx.createImage();
        dpadImg.src = 'images/gamecube_dpad_none.png';
        dpadImg.onload = () => {
            this.ctx.drawImage(dpadImg, dpadX - dpadSize / 2, dpadY - dpadSize / 2, dpadSize, dpadSize);
        };
        const btnAImg = wx.createImage();
        btnAImg.src = 'images/gamecube_button_a_outline.png';
        btnAImg.onload = () => {
            this.ctx.drawImage(btnAImg, btnA_X - btnRadius, btnA_Y - btnRadius, btnRadius * 2, btnRadius * 2);
            // 辅助画判定圆
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

        // 记录当前按下的方向
        this.currentDir = null;
        // 按钮判定函数
        function isInBtn(x, y, btnX, btnY, btnRadius) {
            return Math.sqrt((x - btnX) ** 2 + (y - btnY) ** 2) <= btnRadius;
        }

        // 记录当前A/B按钮状态
        this.currentBtnA = false;
        this.currentBtnB = false;

        // 维护一个 touchMap，记录每个触点对应的 NES 按键
        this.touchMap = {}; // { identifier: 按键名 }

        // 维护当前帧的按键状态，支持多点触控
        this.currentKeys = new Set(); // 记录本地所有按下的NES键名

        // 采集本地输入，返回一个对象 { BUTTON_A: 1, BUTTON_B: 0, ... }
        const collectInput = () => {
            const input = {};
            for (const key of [
                'BUTTON_UP','BUTTON_DOWN','BUTTON_LEFT','BUTTON_RIGHT',
                'BUTTON_A','BUTTON_B','BUTTON_START','BUTTON_SELECT']) {
                input[key] = this.currentKeys.has(key) ? 1 : 0;
            }
            return input;
        };

        // ========== 触摸事件绑定（采集到 currentKeys） ==========
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
                // 先释放不再按下的键
                for (const key of oldKeys) {
                    if (!newKeys.includes(key)) {
                        this.currentKeys.delete(key);
                    }
                }
                // 再按下新按下的键
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

        // ========== 主循环 ==========
        if (!is2P) {
            // 单人模式：本地 requestAnimationFrame
            const runFrame = () => {
                // 应用本地输入到1P
                const input = collectInput();
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
        } else {
            // ========== 2P联机帧同步 ==========
            // 1. 采集本地输入，每帧上传
            // 2. onSyncFrame 收到所有玩家输入后，应用到nes，推进一帧
            // 3. 玩家编号分配：房主为1P，加入者为2P
            //
            // 约定：每帧上传 {input: {BUTTON_A:0/1,...}, frameId: n}
            // onSyncFrame: res.frameDataList = [{openid, data: {input, frameId}}, ...]

            // 获取自己在房间中的编号
            if (this.server && this.server.getRoomInfo) {
                const info = this.server.getRoomInfo();
                if (info && info.memberList) {
                    const openidList = info.memberList.map(m => m.openId);
                    const myOpenid = wx.getOpenDataContext ? wx.getOpenDataContext().openid : '';
                    this.playerIdx = openidList.indexOf(myOpenid) + 1;
                }
            }

            // 帧同步主循环由 onSyncFrame 驱动
            this.server.onSyncFrame((res) => {
                // 收到所有玩家输入帧
                // res.actionList: [{openId, data: {input, frameId}}, ...]
                // 按 openId 排序，房主为1P，加入者为2P
                console.log(res);
                const frameInputs = [null, null, null]; // 1-based: [null, 1P, 2P]
                const info = this.server.getRoomInfo && this.server.getRoomInfo();
                let openidList = info && info.memberList ? info.memberList.map(m => m.openId) : [];
                if (Array.isArray(res.actionList)) {
                    res.actionList.forEach(fd => {
                        const idx = openidList.indexOf(fd.openId) + 1;
                        if (idx === 1 || idx === 2) {
                            frameInputs[idx] = fd.data.input;
                        }
                    });
                }
                // 应用输入到NES
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

            // 定时上传本地输入帧
            this.syncTimer = setInterval(() => {
                const input = collectInput();
                this.server.uploadFrame({
                    data: {
                        input,
                        frameId: this.frameId
                    }
                });
            }, 1000/60); // 60fps
        }

        // 方向判定函数
        function getDirections(x, y, dpadX, dpadY, dpadSize) {
            const dx = x - dpadX;
            const dy = y - dpadY;
            const r = dpadSize / 2;
            if (Math.sqrt(dx * dx + dy * dy) > r) return [];
            const threshold = r * 0.3; // 斜方向判定灵敏度
            let dirs = [];
            if (dy < -threshold) dirs.push('UP');
            if (dy > threshold) dirs.push('DOWN');
            if (dx < -threshold) dirs.push('LEFT');
            if (dx > threshold) dirs.push('RIGHT');
            return dirs;
        }
    }
}

export default Main;
