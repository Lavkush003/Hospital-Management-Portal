import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import {
  assertVisitWriteAccess,
  loadVisitForRead,
  type VisitWithRelations,
} from '../visits/visit-access';
import type { CreateNoteBody, UpdateNoteBody } from './note.validators';

function noteNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Clinical note not found', 'CLINICAL_NOTE_NOT_FOUND');
}

type VisitNoteRecord = Prisma.ClinicalNoteGetPayload<{
  include: {
    author: { select: { id: true; firstName: true; lastName: true; role: true } };
  };
}>;

async function loadVisitNote(visitId: string, noteId: string): Promise<VisitNoteRecord> {
  const note = await prisma.clinicalNote.findFirst({
    where: { id: noteId, visitId },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });

  if (!note) {
    throw noteNotFoundError();
  }

  return note;
}

function assertNoteEditPermission(actor: AuthenticatedUser, note: { authorId: string | null }): void {
  if (actor.role === 'ADMIN') {
    return;
  }

  if (note.authorId !== actor.id) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      'Only the author of a clinical note can edit it',
      'CLINICAL_NOTE_EDIT_FORBIDDEN',
    );
  }
}

export async function listVisitNotes(
  visitId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown[]> {
  const visit = await loadVisitForRead(visitId, actor);

  const notes = await prisma.clinicalNote.findMany({
    where: { visitId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        take: 1,
        select: { revisionNumber: true },
      },
    },
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'CLINICAL_NOTES_LIST_READ',
    entityType: 'Visit',
    entityId: visitId,
    metadata: { patientId: visit.patientId, recordCount: notes.length },
    request,
  });

  return notes;
}

export async function createVisitNote(
  visitId: string,
  input: CreateNoteBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit: VisitWithRelations = await loadVisitForRead(visitId, actor);
  await assertVisitWriteAccess(actor, visit);

  return prisma.$transaction(async (transaction) => {
    const note = await transaction.clinicalNote.create({
      data: {
        visitId,
        patientId: visit.patientId,
        authorId: actor.id,
        content: input.content,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'CLINICAL_NOTE_CREATED',
        entityType: 'ClinicalNote',
        entityId: note.id,
        after: {
          visitId,
          patientId: visit.patientId,
          authorId: actor.id,
          content: note.content,
        },
        request,
      },
      transaction,
    );

    return {
      note: {
        id: note.id,
        visitId: note.visitId,
        patientId: note.patientId,
        content: note.content,
        author: note.author,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        revisionCount: 0,
      },
    };
  });
}

export async function getVisitNote(
  visitId: string,
  noteId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);
  const note = await loadVisitNote(visitId, noteId);

  const revisions = await prisma.clinicalNoteRevision.findMany({
    where: { noteId },
    orderBy: { revisionNumber: 'desc' },
    include: {
      editedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'CLINICAL_NOTE_READ',
    entityType: 'ClinicalNote',
    entityId: noteId,
    metadata: {
      visitId,
      patientId: visit.patientId,
      revisionCount: revisions.length,
    },
    request,
  });

  return {
    note: {
      id: note.id,
      visitId: note.visitId,
      patientId: note.patientId,
      content: note.content,
      author: note.author,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      revisions,
    },
  };
}

export async function updateVisitNote(
  visitId: string,
  noteId: string,
  input: UpdateNoteBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);
  const existing = await loadVisitNote(visitId, noteId);

  if (actor.role === 'CLINICIAN') {
    await assertVisitWriteAccess(actor, visit);
  }

  assertNoteEditPermission(actor, existing);

  return prisma.$transaction(async (transaction) => {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ClinicalNote"
      WHERE "id" = ${noteId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw noteNotFoundError();
    }

    const current = await transaction.clinicalNote.findUniqueOrThrow({ where: { id: noteId } });

    if (current.content === input.content) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'The note content is unchanged',
        'CLINICAL_NOTE_CONTENT_UNCHANGED',
      );
    }

    const latestRevision = await transaction.clinicalNoteRevision.findFirst({
      where: { noteId },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true },
    });

    const revisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

    await transaction.clinicalNoteRevision.create({
      data: {
        noteId,
        revisionNumber,
        previousContent: current.content,
        newContent: input.content,
        editReason: input.editReason ?? null,
        editedById: actor.id,
        editedAt: new Date(),
      },
    });

    const updated = await transaction.clinicalNote.update({
      where: { id: noteId },
      data: { content: input.content },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'CLINICAL_NOTE_REVISED',
        entityType: 'ClinicalNote',
        entityId: noteId,
        before: {
          visitId,
          revisionNumber: revisionNumber - 1,
          content: current.content,
        },
        after: {
          visitId,
          revisionNumber,
          content: updated.content,
        },
        metadata: {
          editReason: input.editReason ?? null,
          editedBy: actor.id,
        },
        request,
      },
      transaction,
    );

    return {
      note: {
        id: updated.id,
        visitId: updated.visitId,
        patientId: updated.patientId,
        content: updated.content,
        author: updated.author,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        revisionCount: revisionNumber,
      },
    };
  });
}
