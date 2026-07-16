/**
 * 沙箱模块
 * 管理智能体的工作区，实现文件操作的路径隔离
 * 所有写操限制在 output/ 目录内
 */
import fs from 'fs'
import path from 'path'

export interface SandboxConfig {
    /** 工作区根目录（项目根目录的真实路径） */
    workspacePath: string
    /** 输出子目录 */
    outputDir?: string
    /** 是否打印操作日志 */
    verbose?: boolean
}

export interface SandboxContext  {
    workspacePath: string
    outputPath: string
    writeFile: (filename: string, content: string) => string
    readFile: (filename: string) => string | null 
    listFiles: () => string[]
    isPathSafe: (targetPath: string) => boolean
}

export function createSandbox(config: SandboxConfig): SandboxContext {
    // 解析成绝对路径，避免相对路径歧义
    const workspacePath = path.resolve(config.workspacePath)
    const outputDir = config.outputDir || 'output'
    const outputPath = path.join(workspacePath,outputDir)
    const verbose = config.verbose ?? true

    // 沙箱初始化时确保输出目录存在
    if (!fs.existsSync(outputPath)) {
        // recursive: true 表示如果父目录不存在也一并创建
        fs.mkdirSync(outputPath, {recursive: true})
    }

    if (verbose) {
        console.log(`[Sandbox] 工作区初始化完成`)
        console.log(`[Sandbox]   真实路径：${workspacePath}`)
        console.log(`[Sandbox]   输出目录：${outputPath}`)
    }

    /**
     * 路径安全检查
     * 目标路径必须在 outputPath 目录内
     */
    function isPathSafe(targetPath: string): boolean{
        const resolved = path.resolve(outputPath, targetPath)
        return resolved.startsWith(outputPath)
    }

    /**
     * 在沙箱内写文件
     * 自动创建子目录
     */
    function writeFile(filename: string, content: string):string {
        // 先做安全检查
        if (!isPathSafe(filename)) {
            throw new Error(`[Sandbox] 安全拦截：路径越界，无法写入 ${filename}`)
        }
        const targetPath = path.join(outputPath, filename)

        // 如果文件路径包含子目录（如 reports/2025/data.md），确保目录存在
        const dir = path.dirname(targetPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(targetPath, content, 'utf-8')

        if (verbose) {
            console.log(`[Sandbox] 文件已写入：${path.relative(workspacePath, targetPath)}`)
        }
        return targetPath
    }

    /**
     * 读取沙箱内的文件
     * 文件不存在时返回 null，不抛错
     */
    function readFile(filename:string): string | null {
        if (!isPathSafe(filename)) {
            console.warn(`[Sandbox] 安全拦截：路径越界，无法读取 ${filename}`)
            return null
        }

        const targetPath = path.join(outputPath, filename)

        if (!fs.existsSync(targetPath)) {
            return null
        }

        return fs.readFileSync(targetPath, 'utf-8')
    }

    /**
     * 列出沙箱内所有文件（递归）
     * 返回相对于 outputPath 的路径列表
     */
    function listFiles(): string[] {
        if (!fs.existsSync(outputPath)) return []

        function walk(dir: string):string[] {
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            return entries.flatMap(entry => {
                const fullPath = path.join(dir, entry.name)
                if (entry.isDirectory()) {
                    return walk(fullPath)
                }
                return [path.relative(outputPath, fullPath)]
            })
        }
        return walk(outputPath)
    }
   return {
        workspacePath,
        outputPath,
        writeFile,
        readFile,
        listFiles,
        isPathSafe,
    }
}
