const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    outcome: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

function blockMutation(next) {
  return next(new Error('Audit logs are immutable'));
}

auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);

module.exports = mongoose.model('AuditLog', auditLogSchema);
