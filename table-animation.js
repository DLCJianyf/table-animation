const AnimationTable = {
    tableData: [], //当前表格数据以及缓存数据
    pageNum: 1, //根据表格高度计算出的分页页码
    pageStep: 0,//根据表格高度计算出的分页显示条目数
    screenPageNum: 1, //真实分页页码
    screenPageStep: 0,//真实分页显示条目数
    total: 0,//数据总量

    offset: 0,
    totalPageNum: 0,//根据表格高度计算出的分页总数
    cachedPage: 2,//缓存页数
    pageHeight: 0,表格高度
    rowPercentage: 0,
    scrolledRows: 0,//滚动过得条目数
    loopNum: 0,//循环次数（数据全部滚动完）
    maxH: 650,//表格最大高度

    timer1: null,//计时器
    duration: 1000,//g滚动一页持续时间
    prevTime: 0,
    timeStamp: 0,
    fps: 60,//滚动速度
    rowHeight: 35,//表格每一行的高度
    easing: {//滚动动画
        linear: function(t) {
            return t;
        }
    },

    loading: false,//loading状态
    isPreCached: false,//是否缓存过了
    isFirstRequest: true,//是否为第一次请求
    isTableScroll: false,//是否为表格滚动
    isJumpPage: false,//是否为分页跳转
    hasRemained: false,
    totalTableData: [],//全部的数据
    remainTableData: [],//下一次滚动所需数据

    /**
     * 表格设置数据
     * 
     * @param {Array} data 
     * @param {Object} style 
     * @param {*} options 
     * @param {Object} queryIns 
     */
    setOptions(data, style = [], options = {}, queryIns) {
        //edit by wangmy
        //如果表格开启播放，并且播放方式为滚动，抛弃平台发送的第一次请求数据，自己重新计算参数并请求
        //否则还是按照原来的逻辑
        if (!this.requestSendFromThis) {
            this.requestSendFromThis = true
            let animationInf = this.getAnimationInf(style, data, queryIns)
            if (animationInf.isResend) {
                this.isTableScroll = true
                queryIns && queryIns.toRow(animationInf.rows, 1, true)
                return false
            }
        }

        let tableData1 = data.rs ? data.rs.value : []
        if (!this.isTableScroll) {
            this.tableData = tableData1
        } else {
            //表格滚动过程中，点击分页跳转
            if (this.isJumpPage) {
                this.isJumpPage = false
                this.totalPageNum = Math.ceil(data.count / this.screenPageStep)
                this.jumpToPageDataCallback(tableData1)
            } else {
                if (this.isFirstRequest) {
                    this.tableData = tableData1
                }
                this.fillData(tableData1)
            }
            //如果表格播放，并且播放方式为滚动，则不走一下流程
            if (!this.isFirstRequest) return false
        }

        if (this.style.animation._playing) {
            this.readyToPlay(data)
        }
    },

    /**
     * 表格播放前准备
     * 
     * @param {Array} data
     */
    readyToPlay(data) {
        //仅在第一次时进行初始化
        if (this.isFirstRequest) {
            data = data || { count: 0 };
            if (data.count) {
                if (this.style.animation._type === "switch") {
                    this.duration = this.style.animation._duration * 1000;
                    this.switchTable(data);
                } else {
                    this.scrollTable(data);
                }
            }
        }

        this.loading = false;
        this.isFirstRequest = false;
    },

    /**
     * 准备滚动参数
     *
     * @param {Object} flattenStyle
     * @param {Object} queryIns
     */
    readyToScroll(flattenStyle, queryIns, data) {
        if (!flattenStyle["grid._horiLine"]) this.rowHeight = 34;

        this.maxH = this.getTableH(
            this.$refs["cardTable-wrapper-outter"],
            flattenStyle
        );
        this.screenPageStep = Math.ceil(this.maxH / this.rowHeight);
        this.duration = flattenStyle["animation._duration"] * 1000;
        let durationPerData = this.duration / queryIns.requestParams.page.rows;
        this.duration = this.screenPageStep * durationPerData;

        this.total = data.count;
        this.totalPageNum = Math.ceil(this.total / this.screenPageStep);
        //是否固定表头
        this.pageHeight = this.screenPageStep * this.rowHeight;

        this.pageStep = queryIns.requestParams.page.rows;
        this.rowPercentage = 1 / this.screenPageStep;
    },

    /**
     * 表格播放方式为整页切换
     *
     * @param {Object} data
     */
    switchTable(data) {
        let me = this;
        let isStop = false;
        let totalPageNum = Math.ceil(
            data.count / me.queryIns.requestParams.page.rows
        );
        if (totalPageNum > 1) {
            me.timer1 = setInterval(() => {
                me.queryIns.requestParams.page.index += 1;
                if (me.queryIns.requestParams.page.index > totalPageNum) {
                    if (me.style.animation._rolling) {
                        me.queryIns.requestParams.page.index = 1;
                    } else {
                        isStop = true;
                        clearInterval(this.timer1);
                    }
                }
                !isStop &&
                    me.queryIns &&
                    me.queryIns.toRow(
                        me.queryIns.requestParams.page.rows,
                        me.queryIns.requestParams.page.index
                    );
            }, me.duration);
        }
    },

    /**
     * 表格播放方式为滚动
     *
     * @param {Object} data
     */
    scrollTable(data) {
        this.autoPlay();
    },

    /**
     * 点击跳转至某一页开始滚动
     *
     * @param {Number} index
     */
    jumpToPage(index) {
        this.loading = true;
        if (this.timer1) clearInterval(this.timer1);
        this.screenPageNum = index;
        //参数重置
        this.offset = 0;
        this.timeStamp = 0;
        this.loopNum = 0;
        this.isJumpPage = true;
        this.isPreCached = false;
        this.hasRemained = false;
        this.tableData = [];
        this.remainData = [];
        this.totalTableData = [];

        let needRows = (index - 1) * this.pageStep;
        this.hasRemained =
            needRows % this.screenPageStep >= this.screenPageStep / 2;
        let needNum =
            (Math.floor(needRows / this.screenPageStep) + 2) *
            this.screenPageStep;
        if (this.hasRemained) {
            this.isPreCached = true;
            needNum += this.screenPageStep;
        }

        this.queryIns && this.queryIns.toRow(needNum, 1);
    },

    /**
     * 跳转后函数回调
     *
     * @param {Object} data
     */
    jumpToPageDataCallback(data) {
        this.remainTableData = [];

        let percentage = 0;
        let needRows = (this.screenPageNum - 1) * this.pageStep;
        let page = Math.floor(needRows / this.screenPageStep);
        this.pageNum = page + 1;

        let tenDigit = page * this.screenPageStep;
        let supplementaryData = data.length - 1 - tenDigit;
        //前n页数据已经走完
        this.totalTableData = this.totalTableData.concat(
            data.splice(1, tenDigit)
        );
        this.scrolledRows = this.totalTableData.length;

        if (supplementaryData >= this.screenPageStep * 2) {
            //添加接下来的两页数据
            this.tableData = this.tableData.concat(
                data.splice(0, this.screenPageStep * 2 + 1)
            );
            this.totalTableData = this.totalTableData.concat(
                this.tableData.slice(1)
            );

            if (this.hasRemained) {
                this.isPreCached = true;
                this.remainTableData = this.remainTableData.concat(
                    data.slice()
                );
                this.totalTableData = this.totalTableData.concat(
                    this.remainTableData.slice()
                );

                this.offset = this.screenPageStep - this.remainTableData.length;
                this.remainTableData = this.remainTableData.concat(
                    this.totalTableData.slice(0, this.offset)
                );
            }
        } else {
            this.tableData = this.tableData.concat(data.slice());
            this.totalTableData = this.totalTableData.concat(
                this.tableData.slice(1)
            );

            this.offset = this.screenPageStep * 2 - this.tableData.length + 1;
            this.tableData = this.tableData.concat(
                this.totalTableData.slice(0, this.offset)
            );

            if (this.hasRemained) {
                this.isPreCached = true;
                this.remainTableData = this.remainTableData.concat(
                    this.totalTableData.slice(
                        this.offset,
                        this.screenPageStep + this.offset
                    )
                );
                this.offset += this.screenPageStep;
            }
        }

        this.createTableTh();

        percentage = (needRows - tenDigit) / this.screenPageStep;
        this.timeStamp = percentage * this.duration;

        this.$nextTick(function() {
            let height = this.pageHeight * percentage;
            this.$refs["table-scroll"] &&
                this.$refs["table-scroll"].scrollTop(height);
            this.loading = false;
            this.autoPlay();
        });
    },

    /**
     * 缓存数据
     *
     * @param {Object} data
     */
    fillData(data) {
        let realTableData = data.slice(1);
        if (!this.isFirstRequest) this.remainTableData = realTableData;
        this.totalTableData = this.totalTableData.concat(realTableData);

        //第一次请求，数据不够2页缓存
        if (
            this.isFirstRequest &&
            realTableData.length < this.cachedPage * this.screenPageStep
        ) {
            this.fillTableData(realTableData);
        }

        //最后一页请求数据不够一页缓存
        if (
            !this.isFirstRequest &&
            this.remainTableData.length < this.screenPageStep
        ) {
            this.fillRemainTableData();
        }
    },

    /**
     * 第一次请求数据时，且请求从第一页开始时，保证表格数据量为两页
     *
     * @param {Array} realTableData
     */
    fillTableData(realTableData) {
        this.offset = this.screenPageStep * 2 - realTableData.length;
        let remainData = this.totalTableData.slice(0, this.offset);
        this.tableData = this.tableData.concat(remainData);
    },

    /**
     * 填充缓存数据数组，保证数组中缓存数据数量为一页的量
     */
    fillRemainTableData() {
        let remain = this.screenPageStep - this.remainTableData.length;
        let remainData = 0;
        let remainOffset = this.totalTableData.length - remain + 1;
        if (this.offset <= remainOffset) {
            if (this.offset === remainOffset) {
                remainData = this.totalTableData.slice(this.offset);
                remainData = remainData.concat([this.totalTableData[0]]);
                this.offset = 1;
            } else {
                remainData = this.totalTableData.slice(
                    this.offset,
                    this.offset + remain
                );
                this.offset += remain;
            }
        } else {
            remainData = this.totalTableData.slice(this.offset);
            this.offset = remain - remainData.length;
            remainData = remainData.concat(
                this.totalTableData.slice(0, this.offset)
            );
        }
        this.remainTableData = this.remainTableData.concat(remainData);
    },

    /**
     * 预先缓存下下一页的数据
     */
    preCachingData() {
        //判断是否还有剩余数据，请求数据并缓存
        if (!this.remainTableData.length) {
            let pageNum = this.pageNum ? this.pageNum : 1;
            let requestPageNum = pageNum + this.cachedPage;
            //数据超出
            if (
                requestPageNum > this.totalPageNum ||
                this.totalTableData.length >= this.total
            ) {
                this.remainTableData.length = [];
                this.fillRemainTableData();
            } else {
                this.queryIns &&
                    this.queryIns.toRow(
                        this.screenPageStep,
                        requestPageNum,
                        false
                    );
                //this.query(this.startTime, this.endTime, this.reportName, requestPageNum, this.screenPageStep)
            }
        }
    },

    /**
     * 停止播放
     */
    stopPlay() {
        let me = this;
        this.setNextPage();

        //由于网络原因或者播放速度过快，导致数据还未来得及缓存
        if (!this.remainTableData.length) {
            this.loading = true;
            let timer = setInterval(() => {
                if (me.remainTableData.length) {
                    clearInterval(timer);
                    me.loading = false;
                    me.prevTime = +new Date();
                    me.updateData.apply(me);
                }
            });
        } else {
            this.updateData.apply(this);
        }
    },

    /**
     * 更新表格数据
     */
    updateData() {
        this.tableData.splice(1, this.screenPageStep);
        this.tableData = this.tableData.concat(this.remainTableData);
        //根据新数据重新构建VNODE
        //优化TODO
        this.createTableTh();
        this.remainTableData = [];

        //纠正位置，防止文字抖动
        this.$refs["table-scroll"] && this.$refs["table-scroll"].scrollTop(0);
    },

    /**
     * 设置下一页
     */
    setNextPage() {
        this.pageNum += 1;
        //最后一页结束回到第一页
        if (this.pageNum > this.totalPageNum) this.pageNum = 1;
    },

    /**
     * 开始播放
     */
    autoPlay() {
        let me = this;
        if (me.timer1) clearInterval(me.timer1);

        if (me.pageHeight) {
            me.$nextTick(function() {
                //初始化前一个时间
                me.prevTime = +new Date();
                //60fps运行
                me.timer1 = setInterval(() => {
                    if (!me.loading) {
                        me.loop();
                    } else {
                        me.prevTime = +new Date();
                    }
                }, 1000 / me.fps);
            });
        }
    },

    /**
     * 轮询
     */
    loop() {
        let curTime = +new Date();
        let passedTime = curTime - this.prevTime;

        this.prevTime = curTime;
        // //累加过去的时间
        this.timeStamp += passedTime;
        if (this.timeStamp > this.duration) this.timeStamp = this.duration;

        //时间比例，匀速
        let percentage = this.easing.linear(this.timeStamp / this.duration);

        if (percentage > 0.5 && !this.isPreCached) {
            this.preCachingData();
            this.isPreCached = true;
        }

        //联动分页
        this.updateRealPageStep(percentage);
        //根据时间更新移动的距离
        this.updateDOM(percentage, this.pageHeight);

        //滚动结束
        if (percentage === 1) {
            //if (this.timer1) clearInterval(this.timer1)
            this.stopPlay();
            this.timeStamp = 0;
            this.prevTime = +new Date();
            this.isPreCached = false;
        }
    },

    /**
     * 联动分页，根据滚动高度进行反算
     *
     * @param {Number} percentage
     */
    updateRealPageStep(percentage) {
        if (percentage >= 1) this.scrolledRows += this.screenPageStep;

        let num =
            percentage >= 1
                ? 1
                : Math.ceil(percentage / this.rowPercentage) || 1;
        let nums = num + this.scrolledRows - this.loopNum * this.total;
        let pageNum = Math.ceil(nums / this.pageStep) || 1;

        if (nums > this.total) {
            pageNum = 1;
            this.loopNum += 1;
        }
        if (pageNum !== this.screenPageNum) this.screenPageNum = pageNum;
    },

    /**
     * 更新DOM元素，滚动条高度
     *
     * @param {Number} percentage
     * @param {Number} pageHeight
     */
    updateDOM(percentage, pageHeight) {
        if (pageHeight > 0) {
            let height = pageHeight * percentage;
            this.$refs["table-scroll"] &&
                this.$refs["table-scroll"].scrollTop(height);
        }
    },

    /**
     * 获取表格最大高度
     *
     * @param {HTMLDOMElement} $el
     * @param {Object} flattenStyle
     */
    getTableH($el, flattenStyle) {
        let col2H = 0;
        if ($el) {
            let height = 0;
            if ($el.getBoundingClientRect) {
                height = $el.getBoundingClientRect().height;
                if (height) col2H = height;
            }

            if (!height && $el.offsetHeight) col2H = $el.offsetHeight;
        }

        col2H -= flattenStyle["base.borderWidth"];
        //表头是否固定
        col2H -= this.rowHeight;
        //col2H = flattenStyle['head._fixed'] ? col2H - this.rowHeight : col2H
        //获取当前卡片id为LtCardView_{1545900297719}的DOM元素
        let parent = $el.parentNode.parentNode.parentNode;
        //当前卡片没有显示工具栏
        if (
            parent &&
            !parent.getElementsByClassName("plugin-card-view-title")
        ) {
            col2H += 30;
        }

        return col2H;
    }
};
