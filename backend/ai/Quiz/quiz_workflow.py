import logging
from typing import Any, Dict
from openai import OpenAI

from app.core.openai_client import model_quality, temp_quality
from app.schemas.quiz import QuizOut 

from . import prompts

logger = logging.getLogger(__name__)

def generate_quiz(
    client: OpenAI,
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
            parsed_response = client.beta.chat.completions.parse(
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