(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AICStorageHealth = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  var QUARANTINE_KEY = 'aics_pb_history_quarantine';

  function plainObject(value){
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }

  function hasId(entry){
    if (!entry) return false;
    if (entry.id == null || entry.id === '') return false;
    if (typeof entry.id === 'number') return Number.isFinite(entry.id);
    if (typeof entry.id === 'string') return !!entry.id.trim();
    return false;
  }

  function hasTimestamp(entry){
    if (!entry) return false;
    if (entry.timestamp == null || entry.timestamp === '') return false;
    var value = Number(entry.timestamp);
    return Number.isFinite(value);
  }

  function validateHistoryEntry(entry){
    var reasons = [];
    if (!plainObject(entry)) {
      return { ok:false, reasons:['not_object'] };
    }
    if (!hasId(entry)) reasons.push('missing_id');
    if (!hasTimestamp(entry)) reasons.push('missing_timestamp');
    if (entry.image_id != null && entry.image_id !== '' && typeof entry.image_id !== 'string') {
      reasons.push('invalid_image_id');
    }
    return { ok:reasons.length === 0, reasons:reasons };
  }

  function quarantinePartition(list){
    var good = [];
    var bad = [];
    (Array.isArray(list) ? list : []).forEach(function(entry, index){
      var result = validateHistoryEntry(entry);
      if (result.ok) good.push(entry);
      else {
        bad.push({
          entry:entry && typeof entry === 'object' ? entry : { value:entry },
          reasons:result.reasons,
          index:index,
          quarantinedAt:Date.now()
        });
      }
    });
    return { good:good, bad:bad };
  }

  function collectReferencedImageIds(history){
    var ids = new Set();
    (Array.isArray(history) ? history : []).forEach(function(entry){
      if (entry && typeof entry.image_id === 'string' && entry.image_id.trim()) {
        ids.add(entry.image_id.trim());
      }
    });
    return ids;
  }

  function normalizeImageIds(imageIds){
    if (!Array.isArray(imageIds)) return [];
    return imageIds.map(function(id){
      if (typeof id === 'string') return id.trim();
      if (id && typeof id.id === 'string') return id.id.trim();
      return '';
    }).filter(Boolean);
  }

  function inspect(history, imageIds, options){
    options = options || {};
    var partition = quarantinePartition(history);
    var referenced = collectReferencedImageIds(partition.good);
    var stored = normalizeImageIds(imageIds);
    var storedSet = new Set(stored);
    var missingImageIds = [];
    referenced.forEach(function(id){
      if (!storedSet.has(id)) missingImageIds.push(id);
    });
    var orphanImageIds = stored.filter(function(id){ return !referenced.has(id); });
    var quota = options.quota && typeof options.quota === 'object' ? {
      usage:Number(options.quota.usage) || 0,
      quota:Number(options.quota.quota) || 0,
      ratio:options.quota.quota > 0 ? (Number(options.quota.usage) || 0) / Number(options.quota.quota) : null
    } : null;
    var historyCount = partition.good.length;
    var imageCount = stored.length;
    var ok = partition.bad.length === 0 && missingImageIds.length === 0;
    return {
      ok:ok,
      historyCount:historyCount,
      imageCount:imageCount,
      quarantineCount:partition.bad.length,
      orphanImageIds:orphanImageIds,
      missingImageIds:missingImageIds,
      quarantineCandidates:partition.bad,
      quota:quota
    };
  }

  function estimateQuota(storageEstimate){
    if (!storageEstimate || typeof storageEstimate !== 'object') return null;
    var usage = Number(storageEstimate.usage);
    var quota = Number(storageEstimate.quota);
    if (!Number.isFinite(usage) && !Number.isFinite(quota)) return null;
    return {
      usage:Number.isFinite(usage) ? usage : 0,
      quota:Number.isFinite(quota) ? quota : 0,
      ratio:Number.isFinite(usage) && Number.isFinite(quota) && quota > 0 ? usage / quota : null
    };
  }

  function formatBytes(bytes){
    var value = Number(bytes) || 0;
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
    if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB';
    return (value / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function summarize(report){
    report = report || inspect([], []);
    var parts = [
      report.historyCount + ' 条历史',
      report.imageCount + ' 张图片'
    ];
    if (report.quarantineCount) parts.push(report.quarantineCount + ' 条已隔离');
    if (report.missingImageIds && report.missingImageIds.length) {
      parts.push(report.missingImageIds.length + ' 条缺图');
    }
    if (report.orphanImageIds && report.orphanImageIds.length) {
      parts.push(report.orphanImageIds.length + ' 张孤立图');
    }
    if (report.quota && report.quota.quota > 0) {
      var pct = report.quota.ratio == null ? '?' : Math.round(report.quota.ratio * 100);
      parts.push('容量 ' + pct + '% (' + formatBytes(report.quota.usage) + '/' + formatBytes(report.quota.quota) + ')');
    }
    return parts.join(' · ');
  }

  return {
    QUARANTINE_KEY:QUARANTINE_KEY,
    validateHistoryEntry:validateHistoryEntry,
    quarantinePartition:quarantinePartition,
    inspect:inspect,
    estimateQuota:estimateQuota,
    formatBytes:formatBytes,
    summarize:summarize
  };
});
