# Git 工作流程

## 分支策略

```
main (保护分支)
  └── develop (开发分支)
       ├── feature/xxx (功能分支)
       ├── fix/xxx (修复分支)
       └── release/x.x.x (发布分支)
```

## 分支说明

| 分支 | 用途 | 合并目标 |
|---|---|---|
| `main` | 生产环境代码，只接受 release 和 hotfix | - |
| `develop` | 开发主分支，集成所有功能 | main |
| `feature/*` | 新功能开发 | develop |
| `fix/*` | Bug 修复 | develop |
| `release/*` | 版本发布准备 | main + develop |

## 提交规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type 类型

- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具变更

### 示例

```
feat(task): add task CRUD operations
fix(sync): resolve duplicate sync issue
docs(api): update API documentation
```

## M0 阶段分支

```
main
  └── develop
       └── feature/m0-project-setup (当前)
```
