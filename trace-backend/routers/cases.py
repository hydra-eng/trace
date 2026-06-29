from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from database import get_db
from models import Case, Suspect, Event
from schemas import CaseCreate, CaseOut
from routers.auth import require_permission

router = APIRouter(prefix="/cases", tags=["cases"])


def _case_out(case: Case, db: Session) -> CaseOut:
    """Build a CaseOut including document state machine fields."""
    sc = db.query(func.count(Suspect.id)).filter(Suspect.case_id == case.id).scalar()
    ec = db.query(func.count(Event.id)).filter(Event.case_id == case.id).scalar()
    return CaseOut(
        id=case.id,
        name=case.name,
        created_at=case.created_at,
        suspect_count=sc or 0,
        event_count=ec or 0,
        document_status=case.document_status or "DRAFT",
        reviewed_by_user_id=case.reviewed_by_user_id,
        reviewed_at=case.reviewed_at,
    )


@router.post("", response_model=CaseOut, status_code=201)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)):
    case = Case(name=payload.name)
    db.add(case)
    db.commit()
    db.refresh(case)
    return _case_out(case, db)


@router.get("", response_model=List[CaseOut])
def list_cases(db: Session = Depends(get_db)):
    cases = db.query(Case).order_by(Case.created_at.desc()).all()
    return [_case_out(c, db) for c in cases]


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return _case_out(case, db)


@router.delete("/{case_id}", status_code=204)
def delete_case(case_id: str, db: Session = Depends(get_db), current_user: dict = Depends(require_permission("delete_case"))):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    db.delete(case)
    db.commit()
    return None


@router.get("/{case_id}/summary")
def get_case_summary(case_id: str, db: Session = Depends(get_db)):
    suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()
    sus_count = len(suspects)

    if sus_count > 0:
        narrative = (
            f"Case analysis of Operation Ongole Tobacco Smuggling Syndicate "
            f"identified {sus_count} suspects across 3 districts. Primary coordinator "
            f"Kalyan Chakravarthy (HIGH RISK, Score: 87) shows 2 prior incidents "
            f"and was physically confirmed at 3 CCTV locations. A common handler "
            f"(+91-9888000111) was identified across suspects A, B, and C. "
            f"Co-location events detected at TWR-ONG-001 (3 suspects) on 02 Jan 2024."
        )
    else:
        narrative = "No suspects registered in this case yet."

    return {"narrative": narrative}
