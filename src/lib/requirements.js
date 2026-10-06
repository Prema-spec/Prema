export function validateRequirementsDocument(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The JSON root must be an object.");
  }

  const tender = data.tender;
  if (!tender || typeof tender !== "object" || Array.isArray(tender)) {
    throw new Error('The JSON must include a "tender" object.');
  }

  const tenderFields = [
    "tender_id",
    "title",
    "procuring_entity",
    "bidder",
    "submission_deadline",
  ];
  for (const field of tenderFields) {
    if (typeof tender[field] !== "string" || !tender[field].trim()) {
      throw new Error(`Tender field "${field}" must be a non-empty string.`);
    }
  }

  const deadline = tender.submission_deadline;
  const parsedDeadline = new Date(`${deadline}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
    Number.isNaN(parsedDeadline.getTime()) ||
    parsedDeadline.toISOString().slice(0, 10) !== deadline
  ) {
    throw new Error('Tender field "submission_deadline" must use YYYY-MM-DD format.');
  }

  if (!Array.isArray(data.requirements)) {
    throw new Error('The JSON must include a "requirements" array.');
  }

  const seenIds = new Set();
  const requirements = data.requirements.map((requirement, index) => {
    if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) {
      throw new Error(`Requirement ${index + 1} must be an object.`);
    }

    const { id, order, title_en, title_bn, mandatory, has_expiry } = requirement;
    if (typeof id !== "string" || !id.trim() || seenIds.has(id)) {
      throw new Error(`Requirement ${index + 1} must have a unique, non-empty id.`);
    }
    seenIds.add(id);

    if (!Number.isFinite(order)) {
      throw new Error(`Requirement "${id}" must have a numeric order.`);
    }
    if (typeof title_en !== "string" || !title_en.trim() || typeof title_bn !== "string" || !title_bn.trim()) {
      throw new Error(`Requirement "${id}" must have non-empty title_en and title_bn values.`);
    }
    if (typeof mandatory !== "boolean" || typeof has_expiry !== "boolean") {
      throw new Error(`Requirement "${id}" must have boolean mandatory and has_expiry values.`);
    }

    return { ...requirement };
  });

  return {
    tender: { ...tender },
    requirements: requirements.sort((left, right) => left.order - right.order),
  };
}

export function getRequirementStatus(requirement, matchedFile, expiryDate, submissionDeadline) {
  if (!matchedFile) {
    return requirement.mandatory ? "missing" : "notProvided";
  }
  if (requirement.has_expiry && !expiryDate) {
    return "expiryNeeded";
  }
  if (requirement.has_expiry && expiryDate < submissionDeadline) {
    return "expired";
  }
  return "ok";
}

export function getStatusRows(requirements, files, matches, expiryDates, submissionDeadline) {
  const filesById = new Map(files.map((file) => [file.id, file]));
  return requirements.map((requirement) => {
    const matchedFile = filesById.get(matches[requirement.id]);
    const status = getRequirementStatus(
      requirement,
      matchedFile,
      expiryDates[requirement.id],
      submissionDeadline,
    );
    return {
      requirement,
      matchedFile,
      status,
      blocksPackage: ["missing", "expiryNeeded", "expired"].includes(status),
    };
  });
}
