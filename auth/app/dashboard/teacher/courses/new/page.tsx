"use client";

import { apiFetch } from "@/lib/api-client";

import { LessonEditor } from "@/components/lesson-editor";
import { useToast } from "@/components/ui/toast-provider";
import "katex/dist/katex.min.css";
import { ChevronRight, GripVertical, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { FormulaKind, FormulaTemplate, InternetFormulaResult } from "./formula-data";
import {
  buildAssignmentTitleFromText,
  detectMaterialTypeFromMime,
  fetchInternetFormulaResults,
  fileToBase64,
  getCourseLevelLabel,
  normalizeMarkdownMath,
  reindexNumericRecord,
  safeUrlTransform,
  toDatetimeLocalValue,
} from "./wizard-helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseLevel = "beginner" | "intermediate" | "advanced";

type LessonUploadFile = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};

type LessonRecord = {
  id: string;
  title: string;
  description: string;
  materials: Array<Record<string, unknown>>;
};

type ExistingLessonMaterial = {
  id: string;
  title: string;
  type: string;
  url: string;
  hasFile: boolean;
  canDelete: boolean;
};

type ExistingLessonAssignment = {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  lessonId: string;
  submissions: number;
};

type TeacherCourseDetailsResponse = {
  course?: {
    id?: string;
    title?: string;
    description?: string;
    level?: CourseLevel;
    modules?: Array<Record<string, unknown>>;
  };
  assignments?: Array<{
    id?: string;
    title?: string;
    description?: string | null;
    dueAt?: string | null;
    lessonId?: string | null;
    submissions?: number;
  }>;
  message?: string;
};

export default function NewTeacherCoursePage() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"course" | "lesson">("course");
  const editingCourseId = useMemo(
    () => searchParams.get("courseId")?.trim() ?? "",
    [searchParams],
  );
  const requestedLessonId = useMemo(
    () => searchParams.get("lessonId")?.trim() ?? "",
    [searchParams],
  );
  const requestedStep = useMemo(
    () => searchParams.get("step")?.trim() ?? "",
    [searchParams],
  );
  const requestedReset = useMemo(
    () => searchParams.get("reset") === "1",
    [searchParams],
  );
  const isEditMode = Boolean(editingCourseId);
  const [draftCourseId, setDraftCourseId] = useState("");
  const [targetLessonId, setTargetLessonId] = useState("");
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [existingLessons, setExistingLessons] = useState<LessonRecord[]>([]);
  const [draggingLessonId, setDraggingLessonId] = useState("");
  const [dropIndicatorLessonId, setDropIndicatorLessonId] = useState("");
  const [keyboardReorderLessonId, setKeyboardReorderLessonId] = useState("");
  const [isReordering, setIsReordering] = useState(false);
  const [autosaveState, setAutosaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");

  const draftStorageKey = useMemo(
    () =>
      editingCourseId
        ? `teacher-course-wizard-draft:${editingCourseId}`
        : "teacher-course-wizard-draft:new",
    [editingCourseId],
  );

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseLevel, setCourseLevel] = useState<CourseLevel>("beginner");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonLecture, setLessonLecture] = useState("");
  const [lessonLectureMathTypeFormula, setLessonLectureMathTypeFormula] =
    useState("");
  const [mathTypeFormulaFields, setMathTypeFormulaFields] = useState<string[]>(
    [],
  );
  const [mathFormulaFields, setMathFormulaFields] = useState<string[]>([]);
  const [chemistryFormulaFields, setChemistryFormulaFields] = useState<
    string[]
  >([]);
  const [codeFields, setCodeFields] = useState<string[]>([]);
  const [lessonLinks, setLessonLinks] = useState<string[]>([]);
  const [lessonFiles, setLessonFiles] = useState<File[]>([]);
  const [existingLessonMaterials, setExistingLessonMaterials] = useState<
    ExistingLessonMaterial[]
  >([]);
  const [existingLessonAssignments, setExistingLessonAssignments] = useState<
    ExistingLessonAssignment[]
  >([]);
  const [assignmentText, setAssignmentText] = useState("");
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [showLinks, setShowLinks] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showAssignmentInput, setShowAssignmentInput] = useState(false);

  const [mathFormulaSearches, setMathFormulaSearches] = useState<
    Record<number, string>
  >({});
  const [chemistryFormulaSearches, setChemistryFormulaSearches] = useState<
    Record<number, string>
  >({});
  const [mathInternetResults, setMathInternetResults] = useState<
    Record<number, InternetFormulaResult[]>
  >({});
  const [chemistryInternetResults, setChemistryInternetResults] = useState<
    Record<number, InternetFormulaResult[]>
  >({});
  const [mathInternetLoading, setMathInternetLoading] = useState<
    Record<number, boolean>
  >({});
  const [chemistryInternetLoading, setChemistryInternetLoading] = useState<
    Record<number, boolean>
  >({});
  const [mathInternetErrors, setMathInternetErrors] = useState<
    Record<number, string>
  >({});
  const [chemistryInternetErrors, setChemistryInternetErrors] = useState<
    Record<number, string>
  >({});

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingExistingMaterialId, setDeletingExistingMaterialId] =
    useState("");
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [deletingAssignmentId, setDeletingAssignmentId] = useState("");

  const appendUniqueLesson = (
    lessons: LessonRecord[],
    lesson: LessonRecord,
  ) => {
    const withoutExisting = lessons.filter((item) => item.id !== lesson.id);
    return [...withoutExisting, lesson];
  };

  const mapExistingLessonMaterials = (
    materials: Array<Record<string, unknown>>,
  ) => {
    return materials
      .map((material, index) => {
        const file =
          typeof material.file === "object" && material.file !== null
            ? (material.file as Record<string, unknown>)
            : null;

        const title = String(material.title ?? "").trim();
        const fileName = String(file?.name ?? "").trim();

        return {
          id: String(material.id ?? `existing-material-${index + 1}`),
          title: title || fileName || `Материал ${index + 1}`,
          type: String(material.type ?? "material").trim(),
          url: String(material.url ?? "").trim(),
          hasFile: Boolean(file && String(file.dataBase64 ?? "").trim()),
          canDelete: String(material.id ?? "").trim().length > 0,
        } satisfies ExistingLessonMaterial;
      })
      .filter((material) => material.type.toLowerCase() !== "lecture");
  };

  const mapExistingLessonAssignments = (
    assignments: TeacherCourseDetailsResponse["assignments"],
    lessonId: string,
  ) => {
    const list = Array.isArray(assignments) ? assignments : [];
    return list
      .filter((item) => String(item?.lessonId ?? "") === lessonId)
      .map((item) => ({
        id: String(item?.id ?? ""),
        title: String(item?.title ?? ""),
        description: String(item?.description ?? ""),
        dueAt: String(item?.dueAt ?? ""),
        lessonId: String(item?.lessonId ?? ""),
        submissions: Number(item?.submissions ?? 0),
      }))
      .filter((item) => item.id.length > 0);
  };

  const mapLessons = (modules: Array<Record<string, unknown>> | undefined) => {
    const list = Array.isArray(modules) ? modules : [];
    return list
      .filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          String(item.type ?? "").toLowerCase() === "lesson",
      )
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          id: String(record.id ?? ""),
          title: String(record.title ?? ""),
          description: String(record.description ?? ""),
          materials: Array.isArray(record.materials)
            ? (record.materials as Array<Record<string, unknown>>)
            : [],
        } satisfies LessonRecord;
      })
      .filter((lesson) => Boolean(lesson.id));
  };

  useEffect(() => {
    if (!isEditMode) {
      // For create mode, check if step=lesson is specified in URL
      if (requestedStep === "lesson") {
        setStep("lesson");
      }
      return;
    }

    const loadExistingData = async () => {
      setIsLoadingInitial(true);
      setError("");

      try {
        const response = await apiFetch(
          `${API_URL}/api/teacher/courses/${editingCourseId}/details`,
          {
            credentials: "include",
          },
        );

        const data = (await response.json()) as TeacherCourseDetailsResponse;

        if (!response.ok) {
          setError(
            data.message ?? "Не удалось загрузить курс для редактирования",
          );
          return;
        }

        setCourseTitle(data.course?.title ?? "");
        setCourseDescription(data.course?.description ?? "");
        setCourseLevel(data.course?.level ?? "beginner");

        const lessons = mapLessons(data.course?.modules);
        setExistingLessons(lessons);

        // If URL specifies step=lesson, go to lesson step
        if (requestedStep === "lesson") {
          setStep("lesson");
        }
        // If editing a specific lesson, load it and go to lesson step
        else if (requestedLessonId) {
          const selectedLesson =
            lessons.find((lesson) => lesson.id === requestedLessonId) ??
            lessons[0] ??
            null;

          if (selectedLesson) {
            setTargetLessonId(selectedLesson.id);
            setLessonTitle(selectedLesson.title);
            setLessonLecture(selectedLesson.description);
            setLessonFiles([]);
            setEditingAssignmentId("");
            setAssignmentText("");
            setAssignmentDueAt("");

            const existingLinks = selectedLesson.materials
              .filter((material) => String(material.type ?? "") === "link")
              .map((material) => String(material.url ?? "").trim())
              .filter((item) => item.length > 0);

            const existingMaterials = mapExistingLessonMaterials(
              selectedLesson.materials,
            );
            const existingAssignments = mapExistingLessonAssignments(
              data.assignments,
              selectedLesson.id,
            );

            setLessonLinks(existingLinks);
            setShowLinks(existingLinks.length > 0);
            setExistingLessonMaterials(existingMaterials);
            setExistingLessonAssignments(existingAssignments);
            setShowMaterials(existingMaterials.length > 0);
            setShowAssignmentInput(existingAssignments.length > 0);
          }

          setStep("lesson");
        }
        // Otherwise stay on course editing step
      } catch {
        setError("Ошибка сети при загрузке курса");
      } finally {
        setIsLoadingInitial(false);
      }
    };

    void loadExistingData();
  }, [isEditMode, editingCourseId, requestedLessonId, requestedStep]);

  useEffect(() => {
    void import("mathlive");
  }, []);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    if (requestedReset) {
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // Reset the form even when browser storage is unavailable.
      }
      setStep("course");
      setCourseTitle("");
      setCourseDescription("");
      setCourseLevel("beginner");
      setLessonTitle("");
      setLessonLecture("");
      setMathTypeFormulaFields([]);
      setMathFormulaFields([]);
      setChemistryFormulaFields([]);
      setCodeFields([]);
      setLessonLinks([]);
      setLessonFiles([]);
      setAssignmentText("");
      setAssignmentDueAt("");
      setShowLinks(false);
      setShowMaterials(false);
      setShowAssignmentInput(false);
      setTargetLessonId("");
      setDraftCourseId("");
      setExistingLessons([]);
      setExistingLessonMaterials([]);
      setExistingLessonAssignments([]);
      setEditingAssignmentId("");
      setDeletingAssignmentId("");
      setLastSavedAt("");
      setAutosaveState("idle");
      return;
    }

    try {
      const rawDraft = window.localStorage.getItem(draftStorageKey);
      if (!rawDraft) {
        return;
      }
      const draft = JSON.parse(rawDraft) as {
        courseTitle?: string;
        courseDescription?: string;
        courseLevel?: CourseLevel;
        lessonTitle?: string;
        lessonLecture?: string;
        mathTypeFormulaFields?: string[];
        mathFormulaFields?: string[];
        chemistryFormulaFields?: string[];
        codeFields?: string[];
        lessonLinks?: string[];
        assignmentText?: string;
        assignmentDueAt?: string;
        showLinks?: boolean;
        showMaterials?: boolean;
        showAssignmentInput?: boolean;
        step?: "course" | "lesson" | "preview";
        lastSavedAt?: string;
      };

      setCourseTitle(draft.courseTitle ?? "");
      setCourseDescription(draft.courseDescription ?? "");
      setCourseLevel(draft.courseLevel ?? "beginner");
      setLessonTitle(draft.lessonTitle ?? "");
      setLessonLecture(draft.lessonLecture ?? "");
      setMathTypeFormulaFields(
        Array.isArray(draft.mathTypeFormulaFields)
          ? draft.mathTypeFormulaFields
          : [],
      );
      setMathFormulaFields(
        Array.isArray(draft.mathFormulaFields) ? draft.mathFormulaFields : [],
      );
      setChemistryFormulaFields(
        Array.isArray(draft.chemistryFormulaFields)
          ? draft.chemistryFormulaFields
          : [],
      );
      setCodeFields(Array.isArray(draft.codeFields) ? draft.codeFields : []);
      setLessonLinks(Array.isArray(draft.lessonLinks) ? draft.lessonLinks : []);
      setAssignmentText(draft.assignmentText ?? "");
      setAssignmentDueAt(draft.assignmentDueAt ?? "");
      setShowLinks(Boolean(draft.showLinks));
      setShowMaterials(Boolean(draft.showMaterials));
      setShowAssignmentInput(Boolean(draft.showAssignmentInput));
      if (draft.step) {
        setStep(draft.step === "preview" ? "lesson" : draft.step);
      }
      setLastSavedAt(draft.lastSavedAt ?? "");
      setAutosaveState("saved");
    } catch {
      setAutosaveState("error");
    }
  }, [draftStorageKey, isEditMode, requestedReset]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isSaving || isLoadingInitial) {
        return;
      }

      setAutosaveState("saving");
      const nextSavedAt = new Date().toISOString();
      const draftPayload = {
        courseTitle,
        courseDescription,
        courseLevel,
        lessonTitle,
        lessonLecture,
        mathTypeFormulaFields,
        mathFormulaFields,
        chemistryFormulaFields,
        codeFields,
        lessonLinks,
        assignmentText,
        assignmentDueAt,
        showLinks,
        showMaterials,
        showAssignmentInput,
        step,
        lastSavedAt: nextSavedAt,
      };

      try {
        window.localStorage.setItem(
          draftStorageKey,
          JSON.stringify(draftPayload),
        );
        setLastSavedAt(nextSavedAt);
        setAutosaveState("saved");
      } catch {
        setAutosaveState("error");
      }
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    assignmentDueAt,
    assignmentText,
    chemistryFormulaFields,
    codeFields,
    courseDescription,
    courseLevel,
    courseTitle,
    draftStorageKey,
    isLoadingInitial,
    isSaving,
    lessonLecture,
    lessonLinks,
    lessonTitle,
    mathTypeFormulaFields,
    mathFormulaFields,
    showAssignmentInput,
    showLinks,
    showMaterials,
    step,
  ]);

  const handleDragOverLesson = (
    event: React.DragEvent<HTMLDivElement>,
    overLessonId: string,
  ) => {
    event.preventDefault();
    setDropIndicatorLessonId(overLessonId);
    if (!draggingLessonId || draggingLessonId === overLessonId) {
      return;
    }

    setExistingLessons((previous) => {
      const currentIndex = previous.findIndex(
        (item) => item.id === draggingLessonId,
      );
      const nextIndex = previous.findIndex((item) => item.id === overLessonId);
      if (currentIndex < 0 || nextIndex < 0) {
        return previous;
      }

      const copy = [...previous];
      const [dragged] = copy.splice(currentIndex, 1);
      copy.splice(nextIndex, 0, dragged);
      return copy;
    });
  };

  const moveLessonByOffset = (lessonId: string, offset: -1 | 1) => {
    setExistingLessons((previous) => {
      const currentIndex = previous.findIndex((item) => item.id === lessonId);
      if (currentIndex < 0) {
        return previous;
      }

      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= previous.length) {
        return previous;
      }

      const copy = [...previous];
      const [moved] = copy.splice(currentIndex, 1);
      copy.splice(nextIndex, 0, moved);
      setDropIndicatorLessonId(copy[nextIndex]?.id ?? "");
      return copy;
    });
  };

  const handleLessonReorderKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    lessonId: string,
  ) => {
    if (event.key === "Escape") {
      setKeyboardReorderLessonId("");
      setDropIndicatorLessonId("");
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setKeyboardReorderLessonId((previous) =>
        previous === lessonId ? "" : lessonId,
      );
      setDropIndicatorLessonId(lessonId);
      return;
    }

    const activeLessonId = keyboardReorderLessonId || lessonId;
    if (activeLessonId !== lessonId) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveLessonByOffset(lessonId, -1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveLessonByOffset(lessonId, 1);
    }
  };

  const saveLessonOrder = async () => {
    if (!editingCourseId || existingLessons.length < 2) {
      return;
    }

    setIsReordering(true);
    setError("");
    try {
      const response = await apiFetch(
        `${API_URL}/api/teacher/courses/${editingCourseId}/lessons/reorder`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lessonIds: existingLessons.map((item) => item.id),
          }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось сохранить порядок уроков");
        toast.error(data.message ?? "Не удалось сохранить порядок уроков");
      } else {
        toast.success("Порядок уроков обновлен");
      }
    } catch {
      setError("Ошибка сети при сохранении порядка уроков");
      toast.error("Ошибка сети при сохранении порядка уроков");
    } finally {
      setIsReordering(false);
    }
  };

  useEffect(() => {
    const timers: number[] = [];

    for (const [rawIndex, rawQuery] of Object.entries(mathFormulaSearches)) {
      const index = Number(rawIndex);
      const query = rawQuery.trim();

      if (query.length < 2) {
        setMathInternetLoading((prev) => ({ ...prev, [index]: false }));
        setMathInternetErrors((prev) => ({ ...prev, [index]: "" }));
        setMathInternetResults((prev) => ({ ...prev, [index]: [] }));
        continue;
      }

      const timer = window.setTimeout(() => {
        setMathInternetLoading((prev) => ({ ...prev, [index]: true }));
        setMathInternetErrors((prev) => ({ ...prev, [index]: "" }));

        void fetchInternetFormulaResults(query, "math")
          .then((results) => {
            setMathInternetResults((prev) => ({ ...prev, [index]: results }));
          })
          .catch(() => {
            setMathInternetErrors((prev) => ({
              ...prev,
              [index]: "Не удалось загрузить результаты из интернета",
            }));
            setMathInternetResults((prev) => ({ ...prev, [index]: [] }));
          })
          .finally(() => {
            setMathInternetLoading((prev) => ({ ...prev, [index]: false }));
          });
      }, 450);

      timers.push(timer);
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [mathFormulaSearches]);

  useEffect(() => {
    const timers: number[] = [];

    for (const [rawIndex, rawQuery] of Object.entries(
      chemistryFormulaSearches,
    )) {
      const index = Number(rawIndex);
      const query = rawQuery.trim();

      if (query.length < 2) {
        setChemistryInternetLoading((prev) => ({ ...prev, [index]: false }));
        setChemistryInternetErrors((prev) => ({ ...prev, [index]: "" }));
        setChemistryInternetResults((prev) => ({ ...prev, [index]: [] }));
        continue;
      }

      const timer = window.setTimeout(() => {
        setChemistryInternetLoading((prev) => ({ ...prev, [index]: true }));
        setChemistryInternetErrors((prev) => ({ ...prev, [index]: "" }));

        void fetchInternetFormulaResults(query, "chemistry")
          .then((results) => {
            setChemistryInternetResults((prev) => ({
              ...prev,
              [index]: results,
            }));
          })
          .catch(() => {
            setChemistryInternetErrors((prev) => ({
              ...prev,
              [index]: "Не удалось загрузить результаты из интернета",
            }));
            setChemistryInternetResults((prev) => ({ ...prev, [index]: [] }));
          })
          .finally(() => {
            setChemistryInternetLoading((prev) => ({
              ...prev,
              [index]: false,
            }));
          });
      }, 450);

      timers.push(timer);
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [chemistryFormulaSearches]);

  const updateFieldByIndex = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => {
    setter((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeFieldByIndex = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLessonLink = (index: number, value: string) => {
    updateFieldByIndex(setLessonLinks, index, value);
  };

  const insertTemplateToField = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    template: FormulaTemplate,
  ) => {
    setter((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const trimmed = item.trim();
        if (!trimmed) {
          return template.latex;
        }

        return `${item}\n${template.latex}`;
      }),
    );
  };

  const removeLessonLink = (index: number) => {
    removeFieldByIndex(setLessonLinks, index);
  };

  const removeFormulaField = (kind: FormulaKind, index: number) => {
    if (kind === "math") {
      removeFieldByIndex(setMathFormulaFields, index);
      setMathFormulaSearches((prev) => reindexNumericRecord(prev, index));
      setMathInternetResults((prev) => reindexNumericRecord(prev, index));
      setMathInternetLoading((prev) => reindexNumericRecord(prev, index));
      setMathInternetErrors((prev) => reindexNumericRecord(prev, index));
      return;
    }

    removeFieldByIndex(setChemistryFormulaFields, index);
    setChemistryFormulaSearches((prev) => reindexNumericRecord(prev, index));
    setChemistryInternetResults((prev) => reindexNumericRecord(prev, index));
    setChemistryInternetLoading((prev) => reindexNumericRecord(prev, index));
    setChemistryInternetErrors((prev) => reindexNumericRecord(prev, index));
  };

  const removeLessonFile = (targetIndex: number) => {
    setLessonFiles((prev) => prev.filter((_, index) => index !== targetIndex));
  };

  const removeExistingLessonMaterial = async (
    material: ExistingLessonMaterial,
  ) => {
    const lessonId = targetLessonId.trim();
    const courseId = (isEditMode ? editingCourseId : draftCourseId).trim();

    if (!courseId || !lessonId || !material.canDelete) {
      setError("Не удалось определить материал для удаления");
      return;
    }

    setDeletingExistingMaterialId(material.id);
    setError("");

    try {
      const response = await apiFetch(
        `${API_URL}/api/teacher/courses/${courseId}/lessons/${lessonId}/materials/${material.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить материал");
        toast.error(data.message ?? "Не удалось удалить материал");
        return;
      }

      setExistingLessonMaterials((prev) =>
        prev.filter((item) => item.id !== material.id),
      );
      toast.success("Материал удален");
    } catch {
      setError("Ошибка сети при удалении материала");
      toast.error("Ошибка сети при удалении материала");
    } finally {
      setDeletingExistingMaterialId("");
    }
  };

  const beginEditExistingAssignment = (
    assignment: ExistingLessonAssignment,
  ) => {
    setEditingAssignmentId(assignment.id);
    setAssignmentText(assignment.description || assignment.title);
    setAssignmentDueAt(toDatetimeLocalValue(assignment.dueAt));
    setShowAssignmentInput(true);
  };

  const removeExistingAssignment = async (assignmentId: string) => {
    setDeletingAssignmentId(assignmentId);
    setError("");

    try {
      const response = await apiFetch(
        `${API_URL}/api/teacher/assignments/${assignmentId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить задание");
        toast.error(data.message ?? "Не удалось удалить задание");
        return;
      }

      setExistingLessonAssignments((prev) =>
        prev.filter((item) => item.id !== assignmentId),
      );
      if (editingAssignmentId === assignmentId) {
        setEditingAssignmentId("");
        setAssignmentText("");
        setAssignmentDueAt("");
      }
      toast.success("Задание удалено");
    } catch {
      setError("Ошибка сети при удалении задания");
      toast.error("Ошибка сети при удалении задания");
    } finally {
      setDeletingAssignmentId("");
    }
  };

  const handleLessonFilesChange = (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    setError("");
    setLessonFiles((prev) => [...prev, ...picked]);
  };

  const openLessonFilePreview = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const openedWindow = window.open(objectUrl, "_blank");

    if (!openedWindow) {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  const handlePastedImages = (files: File[]) => {
    if (!files.length) {
      return;
    }

    setError("");
    setShowMaterials(true);
    setLessonFiles((prev) => [...prev, ...files]);
  };

  const goToLessonStep = async () => {
    if (!courseTitle.trim()) {
      setError("Введите название курса");
      return;
    }

    if (!courseDescription.trim()) {
      setError("Введите описание курса");
      return;
    }

    setError("");

    // If editing course only (no lesson), save and return to lessons list
    if (isEditMode && !requestedLessonId) {
      setIsSaving(true);
      try {
        const updateCourseResponse = await apiFetch(
          `${API_URL}/api/teacher/courses/${editingCourseId}`,
          {
            credentials: "include",
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseTitle.trim(),
              description: courseDescription.trim(),
              level: courseLevel,
            }),
          },
        );

        const updateCourseData = (await updateCourseResponse.json()) as {
          message?: string;
        };

        if (!updateCourseResponse.ok) {
          setError(updateCourseData.message ?? "Не удалось обновить курс");
          return;
        }

        // Redirect back to lessons list
        router.push(
          `/dashboard/teacher/courses?course=${editingCourseId}&updated=1`,
        );
      } catch {
        setError("Ошибка сети при сохранении курса");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // If creating new course or editing course+lesson, move to lesson step
    if (isEditMode && requestedLessonId) {
      // Editing course with lesson - just move to lesson step
      setStep("lesson");
    } else if (!isEditMode) {
      // Creating new course - move to lesson step
      setStep("lesson");
    }
  };

  const addMaterialToLesson = async (
    courseId: string,
    lessonId: string,
    payload: Record<string, unknown>,
  ) => {
    const requestUrl = `${API_URL}/api/teacher/courses/${courseId}/lessons/${lessonId}/materials`;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    let lastMessage = "Не удалось добавить материал";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await apiFetch(requestUrl, {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as { message?: string };
        if (response.ok) {
          return;
        }

        lastMessage = data.message ?? lastMessage;

        const canRetry =
          attempt === 0 && (response.status === 404 || response.status >= 500);
        if (canRetry) {
          await wait(250);
          continue;
        }

        throw new Error(lastMessage);
      } catch (error) {
        if (attempt === 0) {
          await wait(250);
          continue;
        }

        throw error instanceof Error ? error : new Error(lastMessage);
      }
    }

    throw new Error(lastMessage);
  };

  const saveWizard = async () => {
    if (!lessonTitle.trim()) {
      setError("Введите название урока");
      return;
    }

    if (!lessonLecture.trim()) {
      setError("Введите текст урока");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      let courseId = isEditMode ? editingCourseId : draftCourseId;
      if (isEditMode) {
        const updateCourseResponse = await apiFetch(
          `${API_URL}/api/teacher/courses/${editingCourseId}`,
          {
            credentials: "include",
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseTitle.trim(),
              description: courseDescription.trim(),
              level: courseLevel,
            }),
          },
        );

        const updateCourseData = (await updateCourseResponse.json()) as {
          message?: string;
        };

        if (!updateCourseResponse.ok) {
          setError(updateCourseData.message ?? "Не удалось обновить курс");
          return;
        }
      } else if (courseId) {
        const updateCourseResponse = await apiFetch(
          `${API_URL}/api/teacher/courses/${courseId}`,
          {
            credentials: "include",
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseTitle.trim(),
              description: courseDescription.trim(),
              level: courseLevel,
            }),
          },
        );

        const updateCourseData = (await updateCourseResponse.json()) as {
          message?: string;
        };

        if (!updateCourseResponse.ok) {
          setError(updateCourseData.message ?? "Не удалось обновить курс");
          return;
        }
      } else {
        const createCourseResponse = await apiFetch(
          `${API_URL}/api/teacher/courses`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseTitle.trim(),
              description: courseDescription.trim(),
              level: courseLevel,
              publishNow: false,
            }),
          },
        );

        const createCourseData = (await createCourseResponse.json()) as {
          message?: string;
          course?: { id?: string };
        };

        if (!createCourseResponse.ok) {
          setError(createCourseData.message ?? "Не удалось создать курс");
          return;
        }

        courseId = String(createCourseData.course?.id ?? "");
        if (!courseId) {
          setError("Курс создан, но не получен его идентификатор");
          return;
        }

        setDraftCourseId(courseId);
      }

      let lessonId = targetLessonId;
      if (lessonId) {
        const updateLessonResponse = await apiFetch(
          `${API_URL}/api/teacher/courses/${courseId}/lessons/${lessonId}`,
          {
            credentials: "include",
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: lessonTitle.trim(),
              description: lessonLecture,
            }),
          },
        );

        const updateLessonData = (await updateLessonResponse.json()) as {
          message?: string;
        };

        if (!updateLessonResponse.ok) {
          setError(updateLessonData.message ?? "Не удалось обновить урок");
          return;
        }
      } else {
        const createLessonResponse = await apiFetch(
          `${API_URL}/api/teacher/courses/${courseId}/lessons`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: lessonTitle.trim(),
              description: lessonLecture,
            }),
          },
        );

        const createLessonData = (await createLessonResponse.json()) as {
          message?: string;
          lesson?: { id?: string };
        };

        if (!createLessonResponse.ok) {
          setError(
            createLessonData.message ?? "Курс сохранен, но урок не создан",
          );
          return;
        }

        lessonId = String(createLessonData.lesson?.id ?? "");
        if (!lessonId) {
          setError("Урок сохранен, но не получен его идентификатор");
          return;
        }

        setTargetLessonId(lessonId);
      }

      if (!isEditMode && lessonLecture.trim()) {
        await addMaterialToLesson(courseId, lessonId, {
          type: "lecture",
          title: `Лекция: ${lessonTitle.trim()}`,
          text: lessonLecture,
        });
      }

      for (const file of lessonFiles) {
        const dataBase64 = await fileToBase64(file);
        const payloadFile: LessonUploadFile = {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataBase64,
        };

        await addMaterialToLesson(courseId, lessonId, {
          type: detectMaterialTypeFromMime(payloadFile.type),
          title: file.name,
          file: payloadFile,
        });
      }

      if (showAssignmentInput && assignmentText.trim()) {
        if (!assignmentDueAt.trim()) {
          throw new Error("Укажите дедлайн для задания");
        }

        const assignmentRequestUrl = editingAssignmentId
          ? `${API_URL}/api/teacher/assignments/${editingAssignmentId}`
          : `${API_URL}/api/teacher/courses/${courseId}/assignments`;
        const assignmentMethod = editingAssignmentId ? "PUT" : "POST";

        const assignmentResponse = await apiFetch(assignmentRequestUrl, {
          credentials: "include",
          method: assignmentMethod,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: buildAssignmentTitleFromText(assignmentText),
            description: assignmentText.trim(),
            lessonId,
            dueAt: assignmentDueAt,
          }),
        });

        const assignmentData = (await assignmentResponse.json()) as {
          message?: string;
        };

        if (!assignmentResponse.ok) {
          throw new Error(
            assignmentData.message ?? "Урок создан, но задание не сохранено",
          );
        }
      }

      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        toast.error("Курс сохранён, но локальный черновик не удалось удалить.");
      }

      if (isEditMode) {
        toast.success("Курс и урок обновлены");
        router.push(`/dashboard/teacher/courses?course=${courseId}&updated=1`);
      } else {
        setDraftCourseId("");
        toast.success("Курс и урок созданы");
        router.push("/dashboard/teacher");
      }
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "Ошибка сети при сохранении курса",
      );
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Ошибка сети при сохранении курса",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveWizard();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold sm:text-2xl">
            Конструктор курса и урока
          </h1>
          <Link
            href="/dashboard/teacher/courses"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Назад
          </Link>
        </div>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span
              className={
                step === "course"
                  ? "rounded-full bg-slate-900 px-2.5 py-1 text-white"
                  : "rounded-full bg-white px-2.5 py-1"
              }
            >
              Шаг 1: Курс
            </span>
            <span
              className={
                step === "lesson"
                  ? "rounded-full bg-slate-900 px-2.5 py-1 text-white"
                  : "rounded-full bg-white px-2.5 py-1"
              }
            >
              Шаг 2: Урок
            </span>
            <span className="hidden" />
            <span
              role="status"
              className={`ml-auto rounded-xl border px-2.5 py-1 normal-case tracking-normal ${
                autosaveState === "error"
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {autosaveState === "error"
                ? "Не удалось сохранить черновик на устройстве. Не закрывайте страницу до сохранения курса."
                : autosaveState === "saving"
                ? "Сохранение черновика на устройстве..."
                : lastSavedAt
                  ? `Черновик на этом устройстве: ${new Date(lastSavedAt).toLocaleTimeString("ru-RU")}`
                  : "Черновик сохраняется на этом устройстве"}
            </span>
          </div>
        </section>

        {error ? (
          <p className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {isLoadingInitial ? (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm text-slate-600">Загрузка данных курса...</p>
          </section>
        ) : null}

        {!isLoadingInitial && step === "course" ? (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">Шаг 1 из 2</p>
              {isEditMode ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                  Редактирование курса
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Курс
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-700">Название курса</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Например: Базовая алгебра"
                  value={courseTitle}
                  onChange={(event) => setCourseTitle(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-700">Описание курса</label>
                <textarea
                  className="mt-1 min-h-32 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Кратко опишите, чему научится студент"
                  value={courseDescription}
                  onChange={(event) => setCourseDescription(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-700">Уровень курса</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  value={courseLevel}
                  onChange={(event) =>
                    setCourseLevel(event.target.value as CourseLevel)
                  }
                >
                  <option value="beginner">
                    {getCourseLevelLabel("beginner")}
                  </option>
                  <option value="intermediate">
                    {getCourseLevelLabel("intermediate")}
                  </option>
                  <option value="advanced">
                    {getCourseLevelLabel("advanced")}
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void goToLessonStep()}
                disabled={isSaving}
                className="inline-flex h-10 min-w-[220px] items-center justify-center gap-2 rounded-lg border border-blue-400 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {isSaving
                  ? isEditMode
                    ? "Сохранение..."
                    : "Загрузка..."
                  : isEditMode
                    ? "Сохранить изменения"
                    : "Дальше"}
                {!isEditMode && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            {isEditMode && existingLessons.length > 0 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    Порядок уроков (drag and drop)
                  </p>
                  <button
                    type="button"
                    onClick={() => void saveLessonOrder()}
                    disabled={isReordering || existingLessons.length < 2}
                    className="h-8 min-w-[150px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isReordering ? "Сохранение..." : "Сохранить порядок"}
                  </button>
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  Подсказка: перетаскивайте мышью или используйте клавиатуру
                  (Tab, Enter, ArrowUp/ArrowDown, Escape).
                </p>
                <div className="space-y-2">
                  {existingLessons.map((lesson, index) => (
                    <div key={`course-step-lesson-order-${lesson.id}`}>
                      {dropIndicatorLessonId === lesson.id &&
                      draggingLessonId &&
                      draggingLessonId !== lesson.id ? (
                        <div className="mb-2 h-1 rounded-full bg-sky-500" />
                      ) : null}
                      <div
                        draggable
                        tabIndex={0}
                        role="button"
                        aria-label={`Изменить порядок урока ${lesson.title}`}
                        aria-grabbed={
                          keyboardReorderLessonId === lesson.id ||
                          draggingLessonId === lesson.id
                        }
                        onFocus={() => setDropIndicatorLessonId(lesson.id)}
                        onKeyDown={(event) =>
                          handleLessonReorderKeyDown(event, lesson.id)
                        }
                        onDragStart={() => {
                          setDraggingLessonId(lesson.id);
                          setDropIndicatorLessonId(lesson.id);
                        }}
                        onDragOver={(event) =>
                          handleDragOverLesson(event, lesson.id)
                        }
                        onDragEnd={() => {
                          setDraggingLessonId("");
                          setDropIndicatorLessonId("");
                        }}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 outline-none transition ${
                          keyboardReorderLessonId === lesson.id
                            ? "border-sky-400 bg-sky-50"
                            : "border-slate-200 bg-slate-50"
                        } ${
                          dropIndicatorLessonId === lesson.id
                            ? "ring-2 ring-sky-200"
                            : ""
                        }`}
                      >
                        <GripVertical className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-500">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 break-words text-sm text-slate-800">
                          {lesson.title}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {!isLoadingInitial && step === "lesson" ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate-600">Шаг 2 из 2</p>
                {isEditMode ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    Редактирование урока
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    Урок
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <LessonEditor
                  lessonTitle={lessonTitle}
                  lessonContent={lessonLecture}
                  onLessonTitleChange={setLessonTitle}
                  onLessonContentChange={setLessonLecture}
                  onPastedImages={handlePastedImages}
                />

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMaterials((prev) => !prev)}
                      className="w-full whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100 sm:w-auto"
                    >
                      Добавить материалы
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAssignmentInput((prev) => !prev)}
                      className="w-full whitespace-nowrap rounded-lg border border-lime-300 bg-lime-50 px-3 py-1.5 text-sm text-lime-700 hover:bg-lime-100 sm:w-auto"
                    >
                      Добавить задание
                    </button>
                  </div>

                  {showMaterials ? (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3">
                      <p className="text-xs text-slate-700">
                        Можно прикрепить любые типы файлов без ограничения по
                        типу.
                      </p>

                      {existingLessonMaterials.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {existingLessonMaterials.map((material) => (
                            <li
                              key={material.id}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                            >
                              {material.url ? (
                                <a
                                  href={material.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="min-w-0 truncate text-left text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                                  title="Открыть сохраненный материал"
                                >
                                  {material.title}
                                </a>
                              ) : (
                                <span
                                  className="min-w-0 truncate"
                                  title={material.title}
                                >
                                  {material.title}
                                </span>
                              )}
                              {material.canDelete ? (
                                <button
                                  type="button"
                                  disabled={
                                    deletingExistingMaterialId === material.id
                                  }
                                  onClick={() =>
                                    void removeExistingLessonMaterial(material)
                                  }
                                  className="shrink-0 whitespace-nowrap rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                >
                                  {deletingExistingMaterialId === material.id
                                    ? "Удаление..."
                                    : "Удалить"}
                                </button>
                              ) : (
                                <span className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600">
                                  сохранено
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <input
                        type="file"
                        className="mt-2 w-full text-sm text-slate-700"
                        multiple
                        onChange={(event) =>
                          handleLessonFilesChange(event.target.files)
                        }
                      />

                      {lessonFiles.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm text-slate-700">
                          {lessonFiles.map((file, index) => (
                            <li
                              key={`${file.name}-${file.size}-${index}`}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                            >
                              <button
                                type="button"
                                onClick={() => openLessonFilePreview(file)}
                                className="min-w-0 truncate text-left text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                                title="Открыть материал"
                              >
                                {file.name}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLessonFile(index)}
                                className="shrink-0 whitespace-nowrap rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                              >
                                Удалить
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {showAssignmentInput ? (
                    <div className="mt-3 rounded-lg border border-lime-300 bg-lime-50/40 p-3">
                      {existingLessonAssignments.length > 0 ? (
                        <ul className="mb-3 space-y-2 rounded-lg border border-lime-200 bg-white p-2 text-sm text-slate-700">
                          {existingLessonAssignments.map((assignment) => (
                            <li
                              key={assignment.id}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {assignment.title}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {assignment.dueAt
                                    ? `Срок: ${new Date(assignment.dueAt).toLocaleString("ru-RU")}`
                                    : "Срок: не указан"}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    beginEditExistingAssignment(assignment)
                                  }
                                  className="whitespace-nowrap rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                                >
                                  Редактировать
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    deletingAssignmentId === assignment.id
                                  }
                                  onClick={() =>
                                    void removeExistingAssignment(assignment.id)
                                  }
                                  className="whitespace-nowrap rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                >
                                  {deletingAssignmentId === assignment.id
                                    ? "Удаление..."
                                    : "Удалить"}
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <textarea
                        className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder="Текст задания"
                        value={assignmentText}
                        onChange={(event) =>
                          setAssignmentText(event.target.value)
                        }
                      />
                      <div className="mt-2">
                        <label className="text-sm text-slate-700">
                          Дедлайн задания
                        </label>
                        <input
                          type="datetime-local"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={assignmentDueAt}
                          onChange={(event) =>
                            setAssignmentDueAt(event.target.value)
                          }
                          required={
                            showAssignmentInput &&
                            Boolean(assignmentText.trim())
                          }
                        />
                      </div>

                      {editingAssignmentId ? (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAssignmentId("");
                              setAssignmentText("");
                              setAssignmentDueAt("");
                            }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            Отменить редактирование
                          </button>
                        </div>
                      ) : null}

                      {assignmentText.trim() ? (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Preview задания
                          </p>
                          <div className="prose prose-slate max-w-none break-words text-sm leading-6">
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              urlTransform={safeUrlTransform}
                              components={{
                                a: ({ node, ...props }) => (
                                  <a
                                    {...props}
                                    target="_blank"
                                    rel="noreferrer"
                                  />
                                ),
                                img: ({ node, ...props }) => (
                                  <img
                                    {...props}
                                    className="my-3 max-h-[320px] w-auto max-w-full rounded-lg border border-slate-200 object-contain"
                                    loading="lazy"
                                  />
                                ),
                              }}
                            >
                              {normalizeMarkdownMath(assignmentText)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("course")}
                className="h-10 min-w-[180px] rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Назад к курсу
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 min-w-[220px] items-center justify-center gap-2 rounded-lg border border-blue-400 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving
                  ? "Сохранение..."
                  : isEditMode
                    ? "Сохранить изменения"
                    : "Сохранить"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
