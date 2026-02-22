import { mkdir } from "node:fs/promises";
import type { CourseDataResponse, Section, Course } from "./schema";

const MY_FILE = "my.json";
const OUTPUT_DIR = "tsv";
const FACULTY_FILE = `${OUTPUT_DIR}/faculty.tsv`;

// Helper function to create a safe filename from a course name
// Replaces spaces, slashes and other potentially problematic characters with underscores
function safeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

async function generateTSVs() {
  console.log(`Reading ${MY_FILE}...`);

  try {
    const file = Bun.file(MY_FILE);

    if (!(await file.exists())) {
      console.error(`Error: ${MY_FILE} not found. Please provide the file.`);
      return;
    }

    // Ensure output directory exists
    await mkdir(OUTPUT_DIR, { recursive: true });

    const data: CourseDataResponse = await file.json();
    const courses: Course[] = data.data.courses;

    const uniqueFaculties = new Map<string, string>();

    for (const course of courses) {
      const sectionRows: string[] = [];

      // Headers for this course's section TSV
      sectionRows.push("Section\tFaculty Code\tFaculty Name\tRoom\tDay\tTime");

      let firstSectionSeats: number | null = null;
      let seatWarningGiven = false;

      for (const section of course.sections) {
        // Seat checking logic
        if (firstSectionSeats === null) {
          firstSectionSeats = section.total_seats;
        } else if (
          firstSectionSeats !== section.total_seats &&
          !seatWarningGiven
        ) {
          console.warn(
            `WARNING: Course ${course.course_name} (${course.course_code}) has sections with differing total seats. (e.g. ${firstSectionSeats} vs ${section.total_seats})`,
          );
          seatWarningGiven = true;
        }

        // Handle faculty list
        let facultyName = section.faculty_name;
        let facultyCode = section.faculty_code;

        if (facultyName === "TBA" || facultyCode === "TBA") {
          facultyName = "";
          facultyCode = "";
        } else {
          // uniqueFaculties map is tracking ALL faculties across ALL courses/sections because it is defined outside this loop.
          if (!uniqueFaculties.has(facultyCode)) {
            uniqueFaculties.set(facultyCode, facultyName);
          }
        }

        // Handle schedule symmetry
        let displayDay = "";
        let displayTime = "";
        let hasError = false;

        if (section.schedule.length === 1) {
          // Lab or single day
          const schedule = section.schedule[0]!;
          displayDay = schedule.day;
          displayTime = `${schedule.start_time} - ${schedule.end_time}`;
        } else if (section.schedule.length === 2) {
          // Theory typically, expecting symmetry
          const s1 = section.schedule[0]!;
          const s2 = section.schedule[1]!;

          const t1 = `${s1.start_time} - ${s1.end_time}`;
          const t2 = `${s2.start_time} - ${s2.end_time}`;

          if (t1 !== t2) {
            console.error(
              `ERROR: Schedule anomaly: Times don't match for course ${course.course_code} section ${section.section_name}`,
            );
            hasError = true;
          }

          const days = [s1.day, s2.day].sort();

          if (days[0] === "Saturday" && days[1] === "Tuesday") {
            displayDay = "Saturday";
          } else if (days[0] === "Sunday" && days[1] === "Wednesday") {
            displayDay = "Sunday";
          } else {
            console.error(
              `ERROR: Schedule anomaly: Unexpected day pairing (${days.join(", ")}) for course ${course.course_code} section ${section.section_name}. Expected Sat+Tue or Sun+Wed.`,
            );
            hasError = true;
          }

          displayTime = t1;
        } else {
          console.error(
            `ERROR: Schedule anomaly: Unexpected number of days (${section.schedule.length}) for course ${course.course_code} section ${section.section_name}.`,
          );
          hasError = true;
        }

        // If there was an error parsing schedule, fallback to raw data
        if (hasError) {
          displayDay = section.schedule.map((s) => s.day).join(" / ");
          displayTime = section.schedule
            .map((s) => `${s.start_time}-${s.end_time}`)
            .join(" / ");
        }

        const dayCheck = displayDay.toLowerCase();
        if (
          dayCheck.includes("monday") ||
          dayCheck.includes("thursday") ||
          dayCheck.includes("friday")
        ) {
          console.warn(
            `WARNING: Course ${course.course_name} (${course.course_code}) section ${section.section_name} is scheduled on a Monday, Thursday, or Friday: ${displayDay}`,
          );
        }

        displayDay = displayDay
          .replace(/Saturday/gi, "sat")
          .replace(/Sunday/gi, "sun")
          .replace(/Monday/gi, "mon")
          .replace(/Tuesday/gi, "tue")
          .replace(/Wednesday/gi, "wed")
          .replace(/Thursday/gi, "thu")
          .replace(/Friday/gi, "fri");

        // Assemble section row
        const row = [
          section.section_name,
          facultyCode,
          facultyName,
          section.room_details.replace(/\s*-\s*Computer Lab/i, ""),
          displayDay,
          displayTime,
        ].join("\t");

        sectionRows.push(row);
      }

      // Write this course's TSV file using course_name
      const safeName = safeFileName(course.course_name);
      const courseFileName = `${OUTPUT_DIR}/${safeName}.tsv`;
      await Bun.write(courseFileName, sectionRows.join("\n"));
      console.log(`Saved sections list to ${courseFileName}`);
    }

    // Generate Faculty TSV
    const facultyRows = ["Faculty Name\tFaculty Code"];
    for (const [code, name] of uniqueFaculties.entries()) {
      facultyRows.push(`${name}\t${code}`);
    }

    await Bun.write(FACULTY_FILE, facultyRows.join("\n"));
    console.log(`Saved faculty list to ${FACULTY_FILE}`);
  } catch (error) {
    console.error("An error occurred during generation:\n", error);
  }
}

generateTSVs();
