import logging
from typing import Any, Dict
from openai import AsyncOpenAI

from app.core.openai_client import model_quality, temp_quality
from app.schemas.quiz import FinalOpenEvalParsed, QuizOut

from . import prompts

logger = logging.getLogger(__name__)

async def generate_quiz(
    client: AsyncOpenAI,
    *,
    class_grade: str,
    subject: str,
    chapter_title: str,
    plain_text: str,
    mcq: int,
    yesno: int,
    final_open: int,
) -> Dict[str, Any]:
    
    system_text = prompts.quiz_generation_system()
    user_text = prompts.quiz_generation_user(
        class_grade=class_grade,
        subject=subject,
        chapter_title=chapter_title,
        plain_text=plain_text,
        mcq=mcq,
        yesno=yesno,
        final_open=final_open
    )
    
    max_retries = 3

    for attempt in range(max_retries):
        try:
            parsed_response = await client.beta.chat.completions.parse(
                model=model_quality(),
                temperature=temp_quality(),
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                response_format=QuizOut,
            )

            return parsed_response.choices[0].message.parsed.model_dump()
            
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Generování kvízu definitivně selhalo: {e}")
                raise e
            logger.warning(f"Pokus {attempt + 1} o generování kvízu selhal: {e}")


async def regenerate_quiz(
    client: AsyncOpenAI,
    *,
    current_quiz_json: str,
    teacher_comment: str,
) -> Dict[str, Any]:
    system_text = prompts.quiz_edit_system()
    user_text = prompts.quiz_edit_user(
        current_quiz_json=current_quiz_json,
        teacher_comment=teacher_comment,
    )

    max_retries = 3

    for attempt in range(max_retries):
        try:
            parsed_response = await client.beta.chat.completions.parse(
                model=model_quality(),
                temperature=temp_quality(),
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                response_format=QuizOut,
            )

            return parsed_response.choices[0].message.parsed.model_dump()

        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Regenerování kvízu definitivně selhalo: {e}")
                raise e
            logger.warning(f"Pokus {attempt + 1} o regenerování kvízu selhal: {e}")


async def evaluate_final_open_answer(
    client: AsyncOpenAI,
    *,
    question_prompt: str,
    student_answer: str,
    study_notes_md: str = "",
    class_grade: str = "",
    chapter_title: str = "",
) -> FinalOpenEvalParsed:
    """
    Grade a single final_open response via the API structured output (FinalOpenEvalParsed).

    Uses rubric prompts in prompts.final_open_evaluation_*; retries on parse/API errors.
    """
    system_text = prompts.final_open_evaluation_system()
    user_text = prompts.final_open_evaluation_user(
        question_prompt=question_prompt,
        student_answer=student_answer,
        study_notes_md=study_notes_md,
        class_grade=class_grade,
        chapter_title=chapter_title,
    )
    max_retries = 3
    for attempt in range(max_retries):
        try:
            parsed_response = await client.beta.chat.completions.parse(
                model=model_quality(),
                temperature=temp_quality(),
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": user_text},
                ],
                response_format=FinalOpenEvalParsed,
            )
            parsed = parsed_response.choices[0].message.parsed
            if parsed is None:
                raise ValueError("empty parse")
            return parsed
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Hodnocení final_open definitivně selhalo: {e}")
                raise e
            logger.warning(f"Pokus {attempt + 1} o hodnocení final_open selhal: {e}")