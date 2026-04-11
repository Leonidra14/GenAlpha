from sqlalchemy import Column, DateTime, Float, ForeignKey, Identity, Integer, JSON

from database.database import Base


class QuizAttempt(Base):
    """
    Primární klíč `id` se generuje výhradně v databázi (SERIAL / IDENTITY).
    Při vkládání nového řádku v kódu nikdy nepredávej `id` — SQLAlchemy ho z INSERTu vynechá
    a PostgreSQL doplní další hodnotu sekvence.
    """

    __tablename__ = "quiz_attempts"

    id = Column(Integer, Identity(), primary_key=True)

    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    started_at = Column(DateTime(timezone=True), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=False)

    score = Column(Float, nullable=False)
    duration_sec = Column(Integer, nullable=False)

    answers_json = Column(JSON, nullable=False)
    mistakes_json = Column(JSON, nullable=False)
