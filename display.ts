import type { CourseDataResponse, Section, Course } from "./schema";

const MY_FILE = "my.json";
const OUTPUT_DIR = "tsv";
const OUTPUT_FILE = `${OUTPUT_DIR}/display.tsv`;
import { mkdir } from "node:fs/promises";

// Time slots explicitly defined in the templates
const TIME_SLOTS = ["8:30", "9:50", "11:10", "12:30", "13:50", "15:10"];

// Day groupings as requested by the template columns
const DAY_GROUPS = [
  { name: "Sat + Tue", days: ["Saturday", "Tuesday"], type: "theory" },
  { name: "Sat", days: ["Saturday"], type: "lab" },
  { name: "Sun + Wed", days: ["Sunday", "Wednesday"], type: "theory" },
  { name: "Sun", days: ["Sunday"], type: "lab" },
  { name: "Mon", days: ["Monday"], type: "none" },
  { name: "Tue", days: ["Tuesday"], type: "lab" },
  { name: "Wed", days: ["Wednesday"], type: "lab" },
  { name: "Thu", days: ["Thursday"], type: "none" },
  { name: "Fri", days: ["Friday"], type: "none" },
];

function generateShortName(fullName: string): string {
  // Basic logic to generate abbreviations (Software Engineering -> SE)
  // and keep "Laboratory" -> "-lab".
  const words = fullName
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return "UNKNOWN";

  let isLab = false;
  if (words[words.length - 1]!.toLowerCase() === "laboratory") {
    isLab = true;
    words.pop(); // Remove "Laboratory" from the acronym part
  }

  let acronym = words.map((w) => w[0]!.toUpperCase()).join("");
  return isLab ? `${acronym}-lab` : acronym;
}

// Helper to check if a specific 80-minute block is the STARTING block for a section on a specific day.
function isSectionStartingInSlot(
  section: Section,
  targetTime: string,
  expectedDays: string[],
): boolean {
  const [tH, tM] = targetTime.split(":").map(Number);
  const blockStart = (tH || 0) * 60 + (tM || 0);
  const blockEnd = blockStart + 80;

  for (const s of section.schedule) {
    if (expectedDays.includes(s.day)) {
      const [sH, sM] = s.start_time.split(":").map(Number);
      const schedStart = (sH || 0) * 60 + (sM || 0);

      // Check if the actual start time falls within this 80-minute block
      if (schedStart >= blockStart && schedStart < blockEnd) {
        return true;
      }
    }
  }
  return false;
}

async function generateDisplayTSV() {
  console.log(`Reading ${MY_FILE}...`);

  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const file = Bun.file(MY_FILE);
    if (!(await file.exists())) {
      console.error(`Error: ${MY_FILE} not found.`);
      return;
    }

    const data: CourseDataResponse = await file.json();
    const courses = data.data.courses;

    // Track active courses to generate dynamic columns
    const theoryCourses: { code: string; short: string }[] = [];
    const labCourses: { code: string; short: string }[] = [];

    for (const c of courses) {
      const short = generateShortName(c.course_name);
      if (short.endsWith("-lab")) {
        labCourses.push({ code: c.course_code, short });
      } else {
        theoryCourses.push({ code: c.course_code, short });
      }
    }

    // Sort to keep order consistent
    theoryCourses.sort((a, b) => a.short.localeCompare(b.short));
    labCourses.sort((a, b) => a.short.localeCompare(b.short));

    const rows: string[][] = [];

    // --- Header Row 1 ---
    const headerRow1 = ["TIME"];
    for (const group of DAY_GROUPS) {
      headerRow1.push(group.name);
      // Pad the rest of the columns under this group header
      let colCount = 1;
      if (group.type === "theory") colCount = theoryCourses.length;
      else if (group.type === "lab") colCount = labCourses.length;

      for (let i = 1; i < colCount; i++) {
        headerRow1.push("");
      }
    }
    rows.push(headerRow1);

    // --- Header Row 2 (Course Names) ---
    const headerRow2 = [""]; // Empty under "TIME"
    for (const group of DAY_GROUPS) {
      if (group.type === "theory") {
        for (const c of theoryCourses) headerRow2.push(c.short);
      } else if (group.type === "lab") {
        for (const c of labCourses) headerRow2.push(c.short);
      } else {
        headerRow2.push("xxx");
      }
    }
    rows.push(headerRow2);

    // --- Time Slot Rows ---
    for (let slotIdx = 0; slotIdx < TIME_SLOTS.length; slotIdx++) {
      const time = TIME_SLOTS[slotIdx]!;
      // Main time row
      const row = [time];

      for (const group of DAY_GROUPS) {
        if (group.type === "none") {
          row.push("x");
          continue;
        }

        const coursesInGroup =
          group.type === "theory" ? theoryCourses : labCourses;

        for (const courseTarget of coursesInGroup) {
          const c = courses.find((cc) => cc.course_code === courseTarget.code);
          let cellValue = "";

          if (c) {
            for (const section of c.sections) {
              if (isSectionStartingInSlot(section, time, group.days)) {
                cellValue = `${section.faculty_code}-${section.section_name}`;
                break;
              }
            }
          }
          row.push(cellValue);
        }
      }
      rows.push(row);

      // Add 3 padding rows between time slots
      for (let padIdx = 0; padIdx < 3; padIdx++) {
        const padRow = [""];
        for (const group of DAY_GROUPS) {
          if (group.type === "none") {
            padRow.push("x");
            continue;
          }

          const coursesInGroup =
            group.type === "theory" ? theoryCourses : labCourses;

          for (const _ of coursesInGroup) {
            padRow.push(""); // No more duplication in padding rows
          }
        }
        rows.push(padRow);
      }
    }

    // --- Footer Row ---
    const footerRow = ["END"];
    for (const group of DAY_GROUPS) {
      if (group.type === "none") {
        footerRow.push("x");
        continue;
      }
      const coursesInGroup =
        group.type === "theory" ? theoryCourses : labCourses;
      for (const _ of coursesInGroup) {
        footerRow.push("");
      }
    }
    rows.push(footerRow);

    // Create string output
    const tsvContent = rows.map((r) => r.join("\t")).join("\n");
    await Bun.write(OUTPUT_FILE, tsvContent);
    console.log(`Saved schedule to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("An error occurred during display generation:\n", error);
  }
}

generateDisplayTSV();
