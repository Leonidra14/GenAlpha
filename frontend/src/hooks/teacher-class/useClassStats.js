import { useCallback, useEffect, useState } from "react";

import {
  getClassTopics,
  getTeacherClassStatsOverview,
  getTeacherClassTopicStats,
  getTeacherClassRiskStudents,
  regenerateTeacherClassRiskStudents,
} from "../../api/api";

const DEFAULT_THRESHOLD = 50;

export function useClassStats(classId) {
  const [selectedTopicIds, setSelectedTopicIds] = useState([]);
  const [thresholdPercent, setThresholdPercent] = useState(DEFAULT_THRESHOLD);

  const [topicOptions, setTopicOptions] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsError, setTopicsError] = useState("");

  const [overview, setOverview] = useState(null);
  const [topicStats, setTopicStats] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [riskRegenerating, setRiskRegenerating] = useState(false);
  const [riskRegenerateError, setRiskRegenerateError] = useState("");

  const loadTopics = useCallback(async () => {
    if (!classId) return;
    setTopicsError("");
    setTopicsLoading(true);
    try {
      const list = await getClassTopics(classId);
      setTopicOptions(Array.isArray(list) ? list : []);
    } catch (e) {
      setTopicOptions([]);
      setTopicsError(e?.message || "Nepodařilo se načíst témata.");
    } finally {
      setTopicsLoading(false);
    }
  }, [classId]);

  const load = useCallback(async () => {
    if (!classId) return;
    setError("");
    if (!selectedTopicIds.length) {
      setOverview(null);
      setTopicStats(null);
      setRisk(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [o, tp, r] = await Promise.all([
        getTeacherClassStatsOverview(classId, {
          topicIds: selectedTopicIds,
          riskThresholdPercent: thresholdPercent,
        }),
        getTeacherClassTopicStats(classId, { topicIds: selectedTopicIds }),
        getTeacherClassRiskStudents(classId, { topicIds: selectedTopicIds, thresholdPercent }),
      ]);
      setOverview(o);
      setTopicStats(tp);
      setRisk(r);
    } catch (e) {
      setOverview(null);
      setTopicStats(null);
      setRisk(null);
      setError(e?.message || "Nepodařilo se načíst statistiky.");
    } finally {
      setLoading(false);
    }
  }, [classId, selectedTopicIds, thresholdPercent]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    load();
  }, [load]);

  const regenerateRisk = useCallback(async () => {
    if (!classId || !selectedTopicIds.length) return;
    setRiskRegenerateError("");
    setRiskRegenerating(true);
    try {
      const r = await regenerateTeacherClassRiskStudents(classId, {
        topicIds: selectedTopicIds,
        thresholdPercent,
      });
      setRisk(r);
    } catch (e) {
      setRiskRegenerateError(e?.message || "Přegenerování se nezdařilo.");
    } finally {
      setRiskRegenerating(false);
    }
  }, [classId, selectedTopicIds, thresholdPercent]);

  return {
    selectedTopicIds,
    setSelectedTopicIds,
    thresholdPercent,
    setThresholdPercent,
    topicOptions,
    topicsLoading,
    topicsError,
    overview,
    topicStats,
    topicRows: topicStats?.rows ?? [],
    risk,
    loading,
    error,
    reload: load,
    riskRegenerating,
    riskRegenerateError,
    regenerateRisk,
  };
}
