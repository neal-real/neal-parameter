/**
 * ^ 提供数据格式的校验功能 rule
 * #1.数据校验
 */

const Parameter = require("./validate");
const ruleReal = new Parameter({
  validateRoot: true,
  required: true,
});
module.exports = {
  /**
   * > 数据格式校验 : 不能添加规则文件中没有的字段
   * @参数1 : 规则对象||规则文件,路径+文件名
   * @参数2 : 需要校验的数据
   * @返回: 错误原因, 正确无返回值
   */
  validateDataFormat(rule, data) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!data) return reject("无任何校验数据进入");
        
        let objRule;
        if (typeof rule === "object") {
          objRule = rule;
        } else {
          objRule = require(rule);
        }
        if (objRule) {
          const error = ruleReal.validate(objRule, data);
          if (error) {
            reject(error);
          } else {
            const array = Object.keys(data);
            for (let i = 0; i < array.length; i++) {
              const key = array[i];
              if (objRule[key] == undefined) {
                return reject([{ field: "字段越界", message: "不能添加规则之外的字段" }]);
              }
            }
            // 如果没越界
            return resolve();
          }
          
        } else {
          return reject("读取不到规则文件,请检查后在试");
        }
      } catch (error) {
        reject(error.message);
      }
    });
  },
  /**
   * > 数据格式校验 : 可以添加规则文件中没有的字段,没有添加的字段不做校验
   * @参数1 : 规则对象||规则文件,路径+文件名
   * @参数2 : 需要校验的数据
   * @返回: 错误原因, 正确无返回值
   */
  validateDataFormatSimpleMode(rule, data) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!data) return reject("无任何校验数据进入");
        let objRule;
        if (typeof rule === "object") {
          objRule = rule;
        } else {
          objRule = require(rule);
        }
        if (objRule) {
          const error = ruleReal.validate(objRule, data);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        } else {
          return reject("读取不到规则文件,请检查后在试");
        }
      } catch (error) {
        reject(error.message);
      }
    });
  },
};
