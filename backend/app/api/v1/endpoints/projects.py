import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, require_project_role
from app.core.exceptions import AuthorizationError, NotFoundError
from app.db.session import get_db
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailRead,
    ProjectMemberAdd,
    ProjectMemberRead,
    ProjectMemberUpdate,
    ProjectRead,
    ProjectUpdate,
)
from app.services import project_service
from app.services.audit_service import get_audit_service

router = APIRouter()


@router.post(
    "/",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project (creator becomes owner)",
)
async def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    project = await project_service.create_project(db, current_user, project_in)
    project_read = ProjectRead.model_validate(project)
    project_read.my_role = ProjectRole.OWNER
    return project_read


@router.get(
    "/",
    response_model=list[ProjectRead],
    summary="List all projects the current user is a member of",
)
async def list_my_projects(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectRead]:
    results = await project_service.list_user_projects(db, current_user)
    output: list[ProjectRead] = []
    for proj, role in results:
        p_read = ProjectRead.model_validate(proj)
        p_read.my_role = role
        output.append(p_read)
    return output


@router.get(
    "/{project_id}",
    response_model=ProjectDetailRead,
    summary="Get project details with members (requires viewer role or higher)",
)
async def get_project(
    project_id: uuid.UUID,
    project_and_member: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.VIEWER)
    ),
    db: AsyncSession = Depends(get_db),
) -> ProjectDetailRead:
    _, current_member = project_and_member
    project_with_members = await project_service.get_project_with_members(db, project_id)
    if not project_with_members:
        raise NotFoundError(message="Project not found.")

    res = ProjectDetailRead.model_validate(project_with_members)
    res.my_role = current_member.role
    return res


@router.patch(
    "/{project_id}",
    response_model=ProjectRead,
    summary="Update project details (requires admin role or higher)",
)
async def update_project(
    project_in: ProjectUpdate,
    project_and_member: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    project, current_member = project_and_member
    updated_project = await project_service.update_project(db, project, project_in)
    res = ProjectRead.model_validate(updated_project)
    res.my_role = current_member.role
    return res


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project (requires owner role)",
)
async def delete_project(
    project_and_member: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.OWNER)
    ),
    db: AsyncSession = Depends(get_db),
) -> None:
    project, _ = project_and_member
    await project_service.delete_project(db, project)


# --- Project Member Management Endpoints ---


@router.get(
    "/{project_id}/members",
    response_model=list[ProjectMemberRead],
    summary="List project members (requires viewer role or higher)",
)
async def list_members(
    project_id: uuid.UUID,
    _auth: tuple[Project, ProjectMember] = Depends(require_project_role(ProjectRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectMemberRead]:
    members = await project_service.list_project_members(db, project_id)
    return [ProjectMemberRead.model_validate(m) for m in members]


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new member to the project (requires admin role or higher)",
)
async def add_member(
    project_id: uuid.UUID,
    member_in: ProjectMemberAdd,
    project_and_member: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberRead:
    _, current_member = project_and_member

    # Non-owners cannot assign OWNER role
    if member_in.role == ProjectRole.OWNER and current_member.role != ProjectRole.OWNER:
        raise AuthorizationError(message="Only project owners can grant the owner role.")

    member = await project_service.add_project_member(
        db,
        project_id=project_id,
        email=member_in.email,
        role=member_in.role,
    )
    audit_service = get_audit_service()
    await audit_service.record_audit_event(
        db=db,
        project_id=project_id,
        actor_id=current_member.user_id,
        action="member_add",
        entity_type="project_member",
        entity_id=member.id,
        details={"email": member_in.email, "role": member_in.role.value},
    )
    return ProjectMemberRead.model_validate(member)


@router.patch(
    "/{project_id}/members/{member_id}",
    response_model=ProjectMemberRead,
    summary="Update member role (requires admin role or higher)",
)
async def update_member_role(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    role_in: ProjectMemberUpdate,
    project_and_member: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberRead:
    _, current_member = project_and_member

    # Find the member
    members = await project_service.list_project_members(db, project_id)
    target_member = next((m for m in members if m.id == member_id), None)
    if not target_member:
        raise NotFoundError(message="Project member not found.")

    # Only owners can change owner roles or promote to owner
    if (
        target_member.role == ProjectRole.OWNER or role_in.role == ProjectRole.OWNER
    ) and current_member.role != ProjectRole.OWNER:
        raise AuthorizationError(
            message="Only project owners can modify an owner or grant the owner role."
        )

    updated_member = await project_service.update_project_member_role(
        db, target_member, role_in.role
    )
    audit_service = get_audit_service()
    await audit_service.record_audit_event(
        db=db,
        project_id=project_id,
        actor_id=current_member.user_id,
        action="member_role_update",
        entity_type="project_member",
        entity_id=updated_member.id,
        details={"user_id": str(updated_member.user_id), "new_role": role_in.role.value},
    )
    return ProjectMemberRead.model_validate(updated_member)


@router.delete(
    "/{project_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from the project (requires admin role or higher)",
)
async def remove_member(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    project_and_member: tuple[Project, ProjectMember] = Depends(
        require_project_role(ProjectRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
) -> None:
    _, current_member = project_and_member

    members = await project_service.list_project_members(db, project_id)
    target_member = next((m for m in members if m.id == member_id), None)
    if not target_member:
        raise NotFoundError(message="Project member not found.")

    # Only owners can remove an owner
    if target_member.role == ProjectRole.OWNER and current_member.role != ProjectRole.OWNER:
        raise AuthorizationError(message="Only project owners can remove an owner.")

    await project_service.remove_project_member(db, target_member)
    audit_service = get_audit_service()
    await audit_service.record_audit_event(
        db=db,
        project_id=project_id,
        actor_id=current_member.user_id,
        action="member_remove",
        entity_type="project_member",
        entity_id=member_id,
        details={"removed_user_id": str(target_member.user_id)},
    )
