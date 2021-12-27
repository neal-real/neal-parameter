'use strict';
const util = require('util');
/**
 * 正则表达式 = Regexps = RE
 */
// 日期类型 PE
const DATE_TYPE_RE = /^\d{4}\-\d{2}\-\d{2}$/;
// 日期类型2 PE
const DATETIME_TYPE_RE = /^\d{4}\-\d{2}\-\d{2} \d{2}:\d{2}:\d{2}$/;
// ID 类型 PE
const ID_RE = /^\d+$/;

// email PE http://www.regular-expressions.info/email.html
const EMAIL_RE = /^[a-z0-9\!\#\$\%\&\'\*\+\/\=\?\^\_\`\{\|\}\~\-]+(?:\.[a-z0-9\!\#\$\%\&\'\*\+\/\=\?\^\_\`\{\|\}\~\-]+)*@(?:[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?$/i;
// 密码 PE
const PASSWORD_RE = /^[\w\`\~\!\@\#\$\%\^\&\*\(\)\-\_\=\+\[\]\{\}\|\;\:\'\"\,\<\.\>\/\?]+$/;

// URL PE https://gist.github.com/dperini/729294
const URL_RE = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/i;

/**
 * # 1. message(错误消息) 取值: 字符串
 * # 2. code(错误码) 取值: 0
 * # 1. field(错误字段) 取值: undefined 或对应字段
 */

/**
 * 解析类
 * @class 解析类
 */
class Parameter {
  // 类被 new 时
  constructor(opts) {
    // 添加选项设置, 否则为空对象
    opts = opts || {};
    // 限制被验证值必须是一个对象
    if (opts.validateRoot) this.validateRoot = true;
    // 是否开启转换
    if (opts.convert) this.convert = true;
    // 将空字符串(`''`), NaN, Null 转换为undefined
    if (opts.widelyUndefined) this.widelyUndefined = true;
  }

  t() {
    const args = Array.prototype.slice.call(arguments);
    if (typeof this.translate === 'function') {
      return this.translate.apply(this, args);
    } else {
      return util.format.apply(util, args);
    }
  }

  /**
   * > 校验
   * @param {*} rules 规则
   * @param {*} obj 被校验对象
   * @returns 报错返回错误,无错没有返回
   * @api public(公开) 
   */
  validate(rules, obj) {
    if (typeof rules !== 'object') {
      throw new TypeError('规则参数需要是 object 类型');
    }
    // 如果被校验值被强制要求但又不是对象,或是空值则直接返回错误
    if (this.validateRoot && (typeof obj !== 'object' || !obj)) {
      return [{
        message: '被校验的参数,需要是一个 object 类型',
        code: 0,
        field: undefined,
      }];
    }
    // 
    const self = this;
    let errors = [];

    for (const key in rules) {
      // # 1 准备好规则和被校验的值
      // # 1.1格式化规则
      const rule = formatRule(rules[key]);
      // # 1.2获取对应的值
      let value = obj[key];

      /**
      * # 2.调整值
      * # 2.1被校验的值是字符串同时开启剪除前后空格符,则修剪值
      */
      if (typeof value === 'string' && rule.trim === true) {
        value = obj[key] = value.trim();
      }

      // # 2.2将 null / '' / NaN 视为未定义,并处理未定的情况
      let widelyUndefined = this.widelyUndefined;
      // # 2.3 rule 的 key 如果有 widelyUndefined 则获取并作为条件使用
      if ('widelyUndefined' in rule) widelyUndefined = rule.widelyUndefined;
      // # 2.4 符合则改为 undefined
      if (widelyUndefined &&
        (value === '' || value === null || Number.isNaN(value))) {
        value = obj[key] = undefined;
      }
      // # 2.5 value 不为 null 同时不是未定义,则保存真
      const has = value !== null && value !== undefined;
      // # 2.6 如果 value 没有值,则判断是否是必填字段
      if (!has) {
        // # 2.7 不是必填字段,博阿错
        if (rule.required !== false) {
          errors.push({
            message: this.t(key + '字段必须有值'),
            field: key,
            code: this.t('缺少_字段')
          });
        }
        // # 2.8 检查是否有默认值
        if ('default' in rule) {
          obj[key] = rule.default;
        }
        // # 2.9 终止此次循环
        continue;
      }
      // # 3 处理规则类型
      // # 3.1 获取规则类型映射的值
      const checker = TYPE_MAP[rule.type];
      // # 3.2 没有映射的值,则报错
      if (!checker) {
        throw new TypeError('规则类型必须是下列类型之一' + Object.keys(TYPE_MAP).join(', ') +
          ', 但传递了此类型: ' + rule.type);
      }
      // # 3.3 对参数中基本数据类型进行转换
      convert(rule, obj, key, this.convert);
      // ? # 3.4 
      const msg = checker.call(self, rule, obj[key], obj);

      // # 3.5 报错
      if (typeof msg === 'string') {
        errors.push({
          message: msg,
          code: this.t('无效值'),
          field: key
        });
      }
      // # 3.6 是数组,则循环
      if (Array.isArray(msg)) {
        msg.forEach(function (e) {
          const dot = rule.type === 'object' ? '.' : '';
          e.field = key + dot + e.field;
          errors.push(e);
        });
      }
    }
    // 判断错误数组有值的情况,返回错误
    if (errors.length) {
      return errors;
    }
  }
};

/**
 * 模块导出
 * @type {Function}
 */
module.exports = Parameter;

/**
 * 将自定义规则添加到全局规则列表。.
 *
 * @param {String} type
 * @param {Function | RegExp} check
 * @param {Boolean} [override] - override exists rule or not, default is true
 * @param {String|Function} [convertType]
 * @api public
 */
Parameter.prototype.addRule = Parameter.addRule = function addRule(type, check, override, convertType) {
  if (!type) {
    throw new TypeError('`type` 必填项');
  }

  // 新增自定义规则(type, check, convertType)
  if (typeof override === 'string' || typeof override === 'function') {
    convertType = override;
    override = true;
  }

  if (typeof override !== 'boolean') {
    override = true;
  }

  if (!override && TYPE_MAP[type]) {
    throw new TypeError('规则 `' + type + '` 存在');
  }

  if (convertType) {
    if (typeof convertType !== 'string' && typeof convertType !== 'function') {
      throw new TypeError('convertType 应该是字符串或函数');
    }
    Parameter.CONVERT_MAP[type] = convertType;
  }


  if (typeof check === 'function') {
    TYPE_MAP[type] = check;
    return;
  }

  if (check instanceof RegExp) {
    TYPE_MAP[type] = function (rule, value) {
      return checkString.call(this, { format: check }, value);
    };
    return;
  }

  throw new TypeError('check 必须是函数或正则表达式');
};

/**
 * 简单类型映射
 * @type {Object}
 */
const TYPE_MAP = Parameter.TYPE_MAP = {
  number: checkNumber,
  int: checkInt,
  integer: checkInt,
  string: checkString,
  id: checkId,
  date: checkDate,
  dateTime: checkDateTime,
  datetime: checkDateTime,
  boolean: checkBoolean,
  bool: checkBoolean,
  array: checkArray,
  object: checkObject,
  enum: checkEnum,
  email: checkEmail,
  password: checkPassword,
  url: checkUrl,
};

const CONVERT_MAP = Parameter.CONVERT_MAP = {
  number: 'number',
  int: 'int',
  integer: 'int',
  string: 'string',
  id: 'string',
  date: 'string',
  dateTime: 'string',
  datetime: 'string',
  boolean: 'bool',
  bool: 'bool',
  email: 'string',
  password: 'string',
  url: 'string',
};

/**
 * > 格式化一个规则
 * # 解析缩写
 * # 解析 `?` 非必填项
 * # 解析 默认的 convertType
 * 
 * @param {Mixed} rule 规则
 * @returns {Object} 标准规则
 * @api private 私有
 */
function formatRule(rule) {
  rule = rule || {};
  // 
  if (typeof rule === 'string') {
    rule = { type: rule };
  } else if (Array.isArray(rule)) {
    rule = { type: 'enum', values: rule };
  } else if (rule instanceof RegExp) {
    rule = { type: 'string', format: rule };
  }
  // type 类型后有 ? ,则将此选项添加非必填项
  if (rule.type && rule.type[rule.type.length - 1] === '?') {
    rule.type = rule.type.slice(0, -1);
    rule.required = false;
  }

  return rule;
}

/**
 * > 对参数中基本数据类型,进行转换
 * @param {Object} rule 规则
 * @param {Object} obj 被校验的对象
 * @param {String} key 规则和被校验对象的 key
 * @param {Boolean} 是否开启转换
 * @returns obj(key)将完成数据类型转换
 * # 没有发生变化的情况: 
 * # 1. 示例化和规则中都没有开启类型转换,不会有变化,仅返回 undefined
 * # 2. 值是对象,不会有变化 ,仅返回 undefined
 * # 3. 是函数,函数会获得值和被校验对象
 */
function convert(rule, obj, key, defaultConvert) {
  let convertType;
  // 开启转换,获得默认类型的映射
  if (defaultConvert) convertType = CONVERT_MAP[rule.type];
  // 如果规则有指定默认类型,则设定默认类型
  if (rule.convertType) convertType = rule.convertType;
  // 默认类型为 null 则返回 undefined
  if (!convertType) return;

  const value = obj[key];
  // 转换类型仅适用于基本数据
  if (typeof value === 'object') return;

  // 转换类型是函数 把值和被校验对象传递过去
  if (typeof convertType === 'function') {
    obj[key] = convertType(value, obj);
    return;
  }

  switch (convertType) {
    case 'int':
      obj[key] = parseInt(value, 10);
      break;
    case 'string':
      obj[key] = String(value);
      break;
    case 'number':
      obj[key] = Number(obj[key]);
      break;
    case 'bool':
    case 'boolean':
      // 保证返回一个布尔值
      obj[key] = !!value;
      break;
    default:
      // 支持自定义规则添加 convertType
      if (typeof CONVERT_MAP[convertType] === 'function') {
        obj[key] = CONVERT_MAP[rule.type](obj[key]);
      }
  }
}

/**
 * 校验 interger
 * {
 *   max: 100,
 *   min: 0
 * }
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkInt(rule, value) {
  if (typeof value !== 'number' || value % 1 !== 0) {
    return this.t('应该是 integer 类型');
  }

  if (rule.hasOwnProperty('max') && value > rule.max) {
    return this.t('应该小于 %s', rule.max);
  }

  if (rule.hasOwnProperty('min') && value < rule.min) {
    return this.t('应该大于 %s', rule.min);
  }
}

/**
 * 校验 number
 * {
 *   max: 100,
 *   min: 0
 * }
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkNumber(rule, value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return this.t('应该是 number 类型');
  }
  if (rule.hasOwnProperty('max') && value > rule.max) {
    return this.t('应该小于 %s', rule.max);
  }
  if (rule.hasOwnProperty('min') && value < rule.min) {
    return this.t('应该大于 %s', rule.min);
  }
}

/**
 * 校验 字符串
 * {
 *   allowEmpty: true, // resolve default convertType to false, alias to empty)
 *   format: /^\d+$/,
 *   max: 100,
 *   min: 0,
 *   trim: false,
 * }
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkString(rule, value) {
  if (typeof value !== 'string') {
    return this.t('应该是 string 类型');
  }

  // if required === false, set allowEmpty to true by default
  if (!rule.hasOwnProperty('allowEmpty') && rule.required === false) {
    rule.allowEmpty = true;
  }

  const allowEmpty = rule.hasOwnProperty('allowEmpty')
    ? rule.allowEmpty
    : rule.empty;

  if (!value) {
    if (allowEmpty) return;
    return this.t('不应该是 空的');
  }

  if (rule.hasOwnProperty('max') && value.length > rule.max) {
    return this.t('长度应小于 %s', rule.max);
  }
  if (rule.hasOwnProperty('min') && value.length < rule.min) {
    return this.t('长度应大于 %s', rule.min);
  }

  if (rule.format && !rule.format.test(value)) {
    return rule.message || this.t('应该匹配 %s', rule.format);
  }
}

/**
 * 校验 id 格式
 * format: /^\d+/
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkId(rule, value) {
  return checkString.call(this, { format: ID_RE, allowEmpty: rule.allowEmpty }, value);
}

/**
 * 校验 date 格式
 * format: YYYY-MM-DD
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkDate(rule, value) {
  return checkString.call(this, { format: DATE_TYPE_RE, allowEmpty: rule.allowEmpty }, value);
}

/**
 * 校验 date time 格式
 * format: YYYY-MM-DD HH:mm:ss
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkDateTime(rule, value) {
  return checkString.call(this, { format: DATETIME_TYPE_RE, allowEmpty: rule.allowEmpty }, value);
}

/**
 * 校验 boolean
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkBoolean(rule, value) {
  if (typeof value !== 'boolean') {
    return this.t('应该是 boolean 类型');
  }
}

/**
 * 校验 枚举:enum
 * {
 *   values: [0, 1, 2]
 * }
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkEnum(rule, value) {
  if (!Array.isArray(rule.values)) {
    throw new TypeError('检查枚举是否需要数组类型值');
  }
  if (rule.values.indexOf(value) === -1) {
    return this.t('枚举类型应该取值下列之一 %s', rule.values.join(', '));
  }
}

/**
 * 校验 email
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkEmail(rule, value) {
  return checkString.call(this, {
    format: EMAIL_RE,
    message: rule.message || this.t('应该是一个 email'),
    allowEmpty: rule.allowEmpty,
  }, value);
}

/**
 * 校验 密码
 * @param {Object} rule
 * @param {Object} value
 * @param {Object} obj
 * @return {Boolean}
 *
 * @api private
 */

function checkPassword(rule, value, obj) {
  if (!rule.min) {
    rule.min = 6;
  }
  rule.format = PASSWORD_RE;
  const error = checkString.call(this, rule, value);
  if (error) {
    return error;
  }
  if (rule.compare && obj[rule.compare] !== value) {
    return this.t('应该等于 %s', rule.compare);
  }
}

/**
 * 校验 url
 *
 * @param {Object} rule
 * @param {Object} value
 * @return {Boolean}
 * @api private
 */

function checkUrl(rule, value) {
  return checkString.call(this, {
    format: URL_RE,
    message: rule.message || this.t('应该是一个 url 类型'),
    allowEmpty: rule.allowEmpty
  }, value);
}

/**
 * 校验对象
 * {
 *   rule: {}
 * }
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkObject(rule, value) {
  if (typeof value !== 'object') {
    return this.t('应该是一个 object 类型');
  }

  if (rule.rule) {
    return this.validate(rule.rule, value);
  }
}

/**
 * 校验数组
 * {
 *   type: 'array',
 *   itemType: 'string'
 *   rule: {type: 'string', allowEmpty: true}
 * }
 *
 * {
 *   type: 'array'.
 *   itemType: 'object',
 *   rule: {
 *     name: 'string'
 *   }
 * }
 *
 * @param {Object} rule
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function checkArray(rule, value) {
  if (!Array.isArray(value)) {
    return this.t('应该是一个数组');
  }

  if (rule.hasOwnProperty('max') && value.length > rule.max) {
    return this.t('长度应小于 %s', rule.max);
  }
  if (rule.hasOwnProperty('min') && value.length < rule.min) {
    return this.t('长度应大于 %s', rule.min);
  }

  if (!rule.itemType) {
    return;
  }

  const self = this;
  const checker = TYPE_MAP[rule.itemType];
  if (!checker) {
    throw new TypeError('规则类型必须是以下之一 ' + Object.keys(TYPE_MAP).join(', ') +
      ', 但是传递了下面的类型: ' + rule.itemType);
  }

  let errors = [];
  const subRule = rule.itemType === 'object'
    ? rule
    : rule.rule || formatRule(rule.itemType);

  value.forEach(function (v, i) {
    const index = '[' + i + ']';
    const errs = checker.call(self, subRule, v);

    if (typeof errs === 'string') {
      errors.push({
        field: index,
        message: errs,
        code: self.t('无效值')
      });
    }
    if (Array.isArray(errs)) {
      errors = errors.concat(errs.map(function (e) {
        e.field = index + '.' + e.field;
        e.message = e.message;
        return e;
      }));
    }
  });

  return errors;
}
