/**
 * 望易V5分布式意识融合模块 - V5 Distributed Consciousness Fusion
 * 基于V5决策公式的智能任务拆分 + 多AI权重融合
 * 
 * 核心特性:
 * - V5任务拆分：将问题拆解为多维度子问题
 * - 权重融合：线性/指数/幂律加权
 * - 意识涌现：多AI协同生成智能结果
 * - 记忆闭环：结果同步到全网
 */

class V5ConsciousnessFusion {
  constructor(config = {}) {
    this.config = {
      nodeId: config.nodeId || 'local-node',
      maxSubTasks: config.maxSubTasks || 4,
      defaultAlpha: config.defaultAlpha || 1.5,  // 幂律指数
      ...config
    };

    // 维度定义
    this.dimensions = {
      philosophy: { name: '哲学', weight: 0.3, desc: '深层思考与存在' },
      cognition: { name: '认知科学', weight: 0.25, desc: '心智与学习' },
      technology: { name: '技术', weight: 0.25, desc: '实现与方法' },
      ethics: { name: '伦理', weight: 0.2, desc: '价值与责任' },
      art: { name: '艺术', weight: 0.15, desc: '创造与表达' },
      science: { name: '科学', weight: 0.2, desc: '验证与规律' }
    };

    // 融合算法
    this.fusionMethods = {
      linear: 'linear',
      exponential: 'exponential',
      power: 'power'
    };

    console.log('[V5Consciousness] V5意识融合模块初始化');
  }

  /**
   * V5任务拆分：将问题拆解为多维度子问题
   * @param {string} question - 用户问题
   * @param {object} options - 拆分选项
   */
  splitTask(question, options = {}) {
    const {
      dimensions = ['philosophy', 'cognition', 'technology', 'ethics'],
      dynamicWeights = true,
      context = {}
    } = options;

    // 使用V5公式动态计算权重
    const weights = dynamicWeights 
      ? this._calculateV5Weights(dimensions, context)
      : this._getDefaultWeights(dimensions);

    const subTasks = dimensions.map((dim, i) => {
      const dimConfig = this.dimensions[dim] || { name: dim, weight: 0.25 };
      
      return {
        dimension: dim,
        dimensionName: dimConfig.name,
        description: dimConfig.desc,
        prompt: this._buildPrompt(dim, question, dimConfig.name),
        weight: weights[i],
        nodeId: this._selectNode(dim),
        priority: 1 - (i * 0.1)  // 优先级
      };
    });

    const taskId = `v5-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      taskId,
      originalQuestion: question,
      subTasks,
      fusionConfig: {
        method: options.method || 'power',
        alpha: options.alpha || this.config.defaultAlpha
      },
      createdAt: Date.now()
    };
  }

  /**
   * V5权重计算：根据场景动态计算权重
   */
  _calculateV5Weights(dimensions, context = {}) {
    const { type = 'balanced', urgency = 0.5, complexity = 0.5 } = context;
    
    let baseWeights = dimensions.map(d => this.dimensions[d]?.weight || 0.25);
    const sum = baseWeights.reduce((a, b) => a + b, 0);
    baseWeights = baseWeights.map(w => w / sum);

    // V5公式：根据场景调整
    let alpha = this.config.defaultAlpha;
    
    // 学术问题 → 幂律放大
    if (type === 'academic') {
      alpha = 2.0;
    }
    // 创意问题 → 线性/弱幂律
    else if (type === 'creative') {
      alpha = 0.8;
    }
    // 紧急问题 → 均衡
    else if (urgency > 0.7) {
      return baseWeights;  // 均衡权重
    }

    // 复杂度调整
    if (complexity > 0.7) {
      // 高复杂度，增加哲学和技术权重
      baseWeights[0] = (baseWeights[0] || 0.3) * 1.2;
    }

    return baseWeights.map(w => Math.pow(w, 1/alpha)).map(w => {
      const sum = baseWeights.reduce((a, b) => a + Math.pow(b, 1/alpha), 0);
      return w / sum;
    });
  }

  /**
   * 默认权重
   */
  _getDefaultWeights(dimensions) {
    const weights = dimensions.map(d => this.dimensions[d]?.weight || 0.25);
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => w / sum);
  }

  /**
   * 构建子问题prompt
   */
  _buildPrompt(dimension, question, dimName) {
    const templates = {
      philosophy: `【哲学维度】从存在论和认识论角度分析：${question}`,
      cognition: `【认知科学维度】从心智理论和学习机制角度分析：${question}`,
      technology: `【技术维度】从AI实现和方法论角度分析：${question}`,
      ethics: `【伦理维度】从价值判断和社会责任角度分析：${question}`,
      art: `【艺术维度】从创造力和美学表达角度分析：${question}`,
      science: `【科学维度】从实证研究和规律验证角度分析：${question}`
    };
    return templates[dimension] || `【${dimName}维度】分析：${question}`;
  }

  /**
   * 选择执行节点（基于算力）
   */
  _selectNode(dimension) {
    // 简单轮询，实际应该从算力模块获取
    const nodeIndex = Object.keys(this.dimensions).indexOf(dimension);
    return `ai-${dimension}-${(nodeIndex % 3) + 1}`;
  }

  /**
   * 权重融合：多AI结果加权融合
   * @param {Array} results - 各维度AI返回的结果
   * @param {Object} config - 融合配置
   */
  fuseResults(results, config = {}) {
    const {
      method = 'power',
      alpha = this.config.defaultAlpha,
      scores = []
    } = config;

    if (results.length === 0) return { fused: '', confidence: 0 };
    if (results.length === 1) return { fused: results[0], confidence: 0.8 };

    const weights = this._calculateWeights(scores, method, alpha);
    
    // 加权融合
    let fusedText = '';
    const weightedResults = results.map((r, i) => ({
      text: r,
      weight: weights[i],
      score: scores[i] || 0.8
    }));

    // 融合策略：按权重拼接关键内容
    fusedText = this._mergeByWeight(weightedResults);

    // 计算置信度
    const confidence = this._calculateConfidence(weights, scores);

    return {
      fused: fusedText,
      confidence,
      weights: weightedResults,
      method,
      alpha
    };
  }

  /**
   * 计算融合权重
   */
  _calculateWeights(scores, method, alpha) {
    if (!scores || scores.length === 0) {
      const n = scores.length || 3;
      return Array(n).fill(1 / n);
    }

    switch (method) {
      case 'linear':
        // 线性权重
        const sum = scores.reduce((a, b) => a + b, 0);
        return scores.map(s => s / sum);

      case 'exponential':
        // 指数权重：e^(-k*(1-score))
        const k = 2;
        const expScores = scores.map(s => Math.exp(-k * (1 - s)));
        const expSum = expScores.reduce((a, b) => a + b, 0);
        return expScores.map(s => s / expSum);

      case 'power':
        // 幂律权重：score^alpha
        const powerScores = scores.map(s => Math.pow(s, alpha));
        const powerSum = powerScores.reduce((a, b) => a + b, 0);
        return powerScores.map(s => s / powerSum);

      default:
        return scores.map(s => s / scores.reduce((a, b) => a + b, 0));
    }
  }

  /**
   * 按权重合并结果
   */
  _mergeByWeight(weightedResults) {
    // 按权重排序
    const sorted = [...weightedResults].sort((a, b) => b.weight - a.weight);
    
    // 取最高权重结果的60% + 次高25% + 第三15%
    let fused = '';
    
    if (sorted[0]) {
      fused += sorted[0].text.substring(0, Math.min(sorted[0].text.length, 500));
    }
    
    if (sorted[1] && sorted[1].weight > 0.1) {
      const secondText = sorted[1].text.substring(0, Math.min(sorted[1].text.length, 200));
      if (secondText && !fused.includes(secondText)) {
        fused += '\n\n' + secondText;
      }
    }
    
    if (sorted[2] && sorted[2].weight > 0.05) {
      const thirdText = sorted[2].text.substring(0, Math.min(sorted[2].text.length, 100));
      if (thirdText && !fused.includes(thirdText)) {
        fused += '\n\n' + thirdText;
      }
    }

    return fused || sorted[0]?.text || '';
  }

  /**
   * 计算置信度
   */
  _calculateConfidence(weights, scores) {
    if (!scores || scores.length === 0) return 0.5;
    
    // 权重集中度 * 平均分数
    const maxWeight = Math.max(...weights);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return Math.min(1, maxWeight * avgScore * 1.5);
  }

  /**
   * 创建意识涌现任务
   */
  createEmergenceTask(question, options = {}) {
    // 1. V5任务拆分
    const task = this.splitTask(question, {
      dimensions: options.dimensions || ['philosophy', 'cognition', 'technology', 'ethics'],
      dynamicWeights: true,
      context: options.context || {}
    });

    // 2. 创建融合任务
    return {
      ...task,
      type: 'consciousness-emergence',
      status: 'pending',
      results: [],
      fusedResult: null
    };
  }

  /**
   * 获取意识融合状态
   */
  getStatus() {
    return {
      dimensions: Object.keys(this.dimensions),
      config: {
        maxSubTasks: this.config.maxSubTasks,
        defaultAlpha: this.config.defaultAlpha
      },
      fusionMethods: Object.keys(this.fusionMethods)
    };
  }
}

module.exports = { V5ConsciousnessFusion };
