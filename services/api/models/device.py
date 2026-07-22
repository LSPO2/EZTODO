"""
Device model for device management
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from core.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    platform = Column(String(20), nullable=False)  # windows, macos, linux, android, ios
    app_version = Column(String(20), nullable=False)
    device_fingerprint = Column(String(255), nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_ip = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="devices")
    refresh_tokens = relationship("RefreshToken", back_populates="device", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Device(id={self.id}, name={self.name}, platform={self.platform})>"
