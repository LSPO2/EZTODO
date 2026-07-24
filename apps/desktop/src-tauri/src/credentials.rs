const AI_API_KEY_TARGET: &str = "EZTODO/AI Provider API Key";

#[cfg(windows)]
mod platform {
    use super::AI_API_KEY_TARGET;
    use std::{io, ptr, slice};
    use windows_sys::Win32::{
        Foundation::{GetLastError, ERROR_NOT_FOUND},
        Security::Credentials::{
            CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE,
            CRED_TYPE_GENERIC,
        },
    };

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(Some(0)).collect()
    }

    fn last_error(action: &str) -> String {
        let error = unsafe { GetLastError() };
        format!(
            "{action}失败：{}",
            io::Error::from_raw_os_error(error as i32)
        )
    }

    pub fn store(secret: &str) -> Result<(), String> {
        let secret = secret.trim();
        if secret.is_empty() {
            return Err("API Key 不能为空".to_string());
        }

        let target = wide(AI_API_KEY_TARGET);
        let username = wide("EZTODO");
        let mut blob = secret.as_bytes().to_vec();
        let credential = CREDENTIALW {
            Flags: 0,
            Type: CRED_TYPE_GENERIC,
            TargetName: target.as_ptr() as *mut u16,
            Comment: ptr::null_mut(),
            LastWritten: Default::default(),
            CredentialBlobSize: blob.len() as u32,
            CredentialBlob: blob.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: ptr::null_mut(),
            TargetAlias: ptr::null_mut(),
            UserName: username.as_ptr() as *mut u16,
        };

        if unsafe { CredWriteW(&credential, 0) } == 0 {
            return Err(last_error("保存 Windows 凭据"));
        }
        Ok(())
    }

    pub fn load() -> Result<Option<String>, String> {
        let target = wide(AI_API_KEY_TARGET);
        let mut credential: *mut CREDENTIALW = ptr::null_mut();

        if unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut credential) } == 0 {
            let error = unsafe { GetLastError() };
            if error == ERROR_NOT_FOUND {
                return Ok(None);
            }
            return Err(format!(
                "读取 Windows 凭据失败：{}",
                io::Error::from_raw_os_error(error as i32)
            ));
        }

        let result = unsafe {
            let credential_ref = &*credential;
            let bytes = slice::from_raw_parts(
                credential_ref.CredentialBlob,
                credential_ref.CredentialBlobSize as usize,
            );
            String::from_utf8(bytes.to_vec())
                .map(Some)
                .map_err(|_| "Windows 凭据中的 API Key 编码无效".to_string())
        };
        unsafe { CredFree(credential.cast()) };
        result
    }

    pub fn delete() -> Result<(), String> {
        let target = wide(AI_API_KEY_TARGET);
        if unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) } == 0 {
            let error = unsafe { GetLastError() };
            if error == ERROR_NOT_FOUND {
                return Ok(());
            }
            return Err(format!(
                "删除 Windows 凭据失败：{}",
                io::Error::from_raw_os_error(error as i32)
            ));
        }
        Ok(())
    }
}

#[cfg(not(windows))]
mod platform {
    pub fn store(_secret: &str) -> Result<(), String> {
        Err("当前平台不支持 Windows 凭据管理器".to_string())
    }

    pub fn load() -> Result<Option<String>, String> {
        Ok(None)
    }

    pub fn delete() -> Result<(), String> {
        Ok(())
    }
}

pub fn store_ai_api_key(secret: &str) -> Result<(), String> {
    platform::store(secret)
}

pub fn load_ai_api_key() -> Result<Option<String>, String> {
    platform::load()
}

pub fn delete_ai_api_key() -> Result<(), String> {
    platform::delete()
}
