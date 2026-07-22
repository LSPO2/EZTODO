"""
Sync models for synchronization
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, BigInteger, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from core.database import Base


class SyncOperation(Base):
    __tablename__ = "sync_operations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    operation_id = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    entity_type = Column(String(20), nullable=False)  # task, project, tag, reminder, recurrence_rule
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    operation = Column(String(10), nullable=False)  # create, update, delete
    payload = Column(JSONB, nullable=False)
    base_revision = Column(Integer, nullable=True)
    server_version = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<SyncOperation(id={self.id}, operation={self.operation}, entity_type={self.entity_type})>"


class SyncCursor(Base):
    __tablename__ = "sync_cursors"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    last_cursor = Column(BigInteger, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<SyncCursor(user_id={self.user_id}, last_cursor={self.last_cursor})>"
