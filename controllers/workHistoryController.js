const workHistoryService = require("../services/workHistoryService");
const logger = require("../config/logger");

const listForClinic = async (req, res, next) => {
  try {
    const clinicId = req.user.clinic_id;
    const { page, limit } = req.query;

    const result = await workHistoryService.listForClinic(clinicId, {
      page,
      limit,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

const listForAssistant = async (req, res, next) => {
  try {
    const assistantId = req.user.sub;
    const { page, limit } = req.query;

    const result = await workHistoryService.listForAssistant(assistantId, {
      page,
      limit,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

module.exports = {
  listForClinic,
  listForAssistant,
};
