import { prisma } from "./index";
import type { Prisma } from "@prisma/client";
import { getDefaultProjectTasks } from "@/lib/build/default-tasks";

// ---------------------------------------------------------------------------
// Project helpers. Distribution-era columns (company, contactEmail, envVars,
// industry, enabledFeatures, currentPhase, deletedAt, launchDate) were dropped
// when we forked. Real-estate builds attach projects to Organization instead,
// and the 28-task operator checklist lives in lib/build/default-tasks.ts.
// TODO(Sprint 03): the intake wizard will hydrate Organization + Project
// together and seed the default tasks below.
// ---------------------------------------------------------------------------

export async function getProjects(opts?: { status?: string; search?: string }) {
  const where: Prisma.ProjectWhereInput = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.search) {
    where.OR = [
      { name: { contains: opts.search, mode: "insensitive" } },
      { description: { contains: opts.search, mode: "insensitive" } },
    ];
  }
  return prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      org: { select: { id: true, name: true, slug: true, status: true } },
      _count: { select: { notes: true, tasks: true } },
    },
  });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      org: true,
      notes: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ phase: "asc" }, { sortOrder: "asc" }] },
    },
  });
}

export type CreateProjectData = Omit<
  Prisma.ProjectCreateInput,
  "createdAt" | "updatedAt" | "notes" | "tasks" | "costs"
>;

export async function createProject(data: CreateProjectData) {
  return prisma.project.create({ data });
}

export async function updateProject(id: string, data: Prisma.ProjectUpdateInput) {
  if (data.status === "completed" && !data.completedAt) {
    data.completedAt = new Date();
  }
  return prisma.project.update({ where: { id }, data });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}

export async function convertIntakeToProject(intakeId: string, orgId: string) {
  const intake = await prisma.intakeSubmission.findUnique({ where: { id: intakeId } });
  if (!intake) throw new Error("Intake not found");

  const defaultTasks = getDefaultProjectTasks();

  const project = await prisma.project.create({
    data: {
      orgId,
      name: `${intake.companyName} Build`,
      description: `Tenant build initiated from intake ${intake.id}`,
      status: "active",
      startedAt: new Date(),
      tasks: {
        createMany: {
          data: defaultTasks.map((t, idx) => ({
            title: t.label,
            description: t.description ?? null,
            phase: t.phase != null ? String(t.phase) : null,
            sortOrder: idx,
          })),
        },
      },
    },
  });

  await prisma.intakeSubmission.update({
    where: { id: intakeId },
    data: { reviewedAt: new Date(), convertedAt: new Date(), orgId },
  });

  return project;
}

export async function addNote(
  projectId: string,
  data: { body: string; authorUserId?: string }
) {
  return prisma.projectNote.create({
    data: {
      projectId,
      body: data.body,
      authorUserId: data.authorUserId ?? null,
    },
  });
}

export async function deleteNote(noteId: string) {
  return prisma.projectNote.delete({ where: { id: noteId } });
}

export async function addTask(
  projectId: string,
  data: { title: string; phase?: string; description?: string; sortOrder?: number }
) {
  return prisma.projectTask.create({
    data: {
      projectId,
      title: data.title,
      description: data.description ?? null,
      phase: data.phase ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateTask(
  taskId: string,
  data: {
    status?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
    title?: string;
    description?: string;
  }
) {
  const update: Prisma.ProjectTaskUpdateInput = { ...data };
  if (data.status === "DONE") update.completedAt = new Date();
  return prisma.projectTask.update({ where: { id: taskId }, data: update });
}

export async function deleteTask(taskId: string) {
  return prisma.projectTask.delete({ where: { id: taskId } });
}
