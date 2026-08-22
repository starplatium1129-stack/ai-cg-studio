'use strict';

/**
 * routes/video/errors.js —— 服务错误工厂与基础守卫。
 * serviceError 产生的错误由路由层转译为 envelope.fail（status/code/detail），
 * isPlainObject / hasOwn 是请求体校验的通用守卫。
 */

function serviceError(status, code, message, detail) {
  var error = new Error(message);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

module.exports = {
  serviceError:serviceError,
  isPlainObject:isPlainObject,
  hasOwn:hasOwn,
};
