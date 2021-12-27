/*
 ^ 提供用户变更邮箱的变更阶段的数据校验
*/

module.exports = {
  user_id: {
    type: 'string',
    trim: true,       // 数据两头空格去除
    required: false,  // 非必项
    message: '用户 ID 不能为空'
  },
  type: {
    type: 'enum',     // 枚举
    values: ['position', 'home_item'],
    message: '值类型必须二选一'
  },
  home_item: {
    type: 'enum',
    values: ['Renew', 'recommend', 'share', 'download', 'help'],
  },
  index: {
    required: false,
    type: 'int',      // 数字类型
    max: 5,           //最大值
    min: 0            //最小值
  },
  商品名称: {
    type: 'string',
  },
}