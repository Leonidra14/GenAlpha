import { useEffect, useState } from "react";
import { fetchTopicHeader } from "../../api/api";

export function useTopicHeaderData(classId, topicId) {
  const [classTitle, setClassTitle] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [classDetail, setClassDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHeader() {
      try {
        const data = await fetchTopicHeader(classId, topicId);
        if (cancelled) return;
        setClassDetail(data.classDetail);
        setClassTitle(data.classTitle);
        setTopicTitle(data.topicTitle);
      } catch {
        if (cancelled) return;
        setClassTitle(`Třída ${classId}`);
        setTopicTitle(`Kapitola ${topicId}`);
        setClassDetail(null);
      }
    }

    loadHeader();
    return () => {
      cancelled = true;
    };
  }, [classId, topicId]);

  return { classTitle, topicTitle, classDetail };
}
