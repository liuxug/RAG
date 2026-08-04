#### pm2  nodejs 热重载工具

```
npm install pm2 -g  

linux :
先运行一个脚本如 pm2 start app.js
保存进程信息 pm2 save
生成启动脚本 pm2 startup
开机自启命令 pm2 startup systemd
保存自启命令 pm2 save
删除自动启动 pm2 unstartup systemd
保存删除启动 pm2 save

windows :
安装windows自动启动包 npm install pm2-windows-startup -g
安装自启脚本 pm2-startup install
启动服务 pm2 start xxxx
暂停服务 pm2 stop idxxx
保存自启服务 pm2 save	
删除自动启动 pm2-startup uninstall
--------------------------------------------------------------------------------------------------------------------------------
PM2 是一个非常流行的 Node.js 进程管理工具，用于在生产环境中运行和监控 Node.js 应用程序。它提供了多种功能，帮助开发者更好地管理和优化他们的应用程序,pm2 能做的其实有很多,比如监听文件改动自动重启,统一管理多个进程,内置的负载均衡,日志系统等等
```

```cmd
windos:
    netstat -ano | findstr :3000     //查看端口情况     
    taskkill /PID 22492 /F             //停止端口运行     

linux:
  	sudo netstat -tunlp   //查看端口情况
```



```
1.下载 | Node.js 中文网 (nodejs.cn)，上传至服务器。      linux版本

2.将.tar解压为普通文件  cd /home/file             tar -xvJf   node-v24.14.1-linux-x64.tar.xz   rm -rf node-v24.14.1-linux-x64
	

3.配置环境变量，全局可用Node  
 3.1 /etc/profile 配置文件添加配置，将Node全局可用，路径使用自己的Node文件夹路径。 
 		NODE_HOME="/home/file/node-v24.1.1-linux-x64"
		export PATH=$NODE_HOME/bin:$PATH

4.重新加载配置文件，使其生效     source /etc/profile

5.查看是否生效   node -v

6.下载PM2   npm install pm2 -g

7.切换镜源 npm config set registry https://mirrors.huaweicloud.com/repository/npm/

8. 启动 pm2 start 启动文件

9. 配置开机自启动 pm2 startup：设置开通自启(需要root权限)，如果不是root用户需要使用sudo。配置完应用后记得使用pm2 save保存当前配置服务器重启后会自动生    效。


 Centos7版本服务器支持 14.3.0,16.20.2  node
```

![image-20260331173442998](C:\Users\admin\AppData\Roaming\Typora\typora-user-images\image-20260331173442998.png)

```
linux  安装nvm               Centos7版本服务器支持 14.3.0,16.20.2   node

1.安装命令： 
	1.1
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
        wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
	1.2
		# gitee本地下载nvm，版本可以重新指定
		git clone https://gitee.com/mirrors/nvm.git ~/.nvm/nvm-0.39.1
		xftp传输nvm-0.39包
	
2.  vim ~/.bashrc ,添加如下配置
	export NVM_DIR="/home/file/nvm-0.39.1"   
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node/
    
    # 使配置生效
    source ~/.bashrc

    nvm --version
    nvm ls-remote //查看可以安装的node版本\
   
```

```
svg-captcha  nodejs生成图形验证码
jwt  (josn web token)        生成单token             
```

​         

```
邮箱POP3/SMTP/IMAP服务码
19325723352@163.com     AJSe6sCZbD68Pr4G
2470644228@qq.com       vqqdvesbondeeaci
lxg05919@126.com          ELUXb39mJcm7wX8s
663945676@qq.com        chuyogxbsutdbejb

https://www.freetoolio.net/cn/  图片编辑


wiki:# 重新加载配置
systemctl daemon-reload

# 启动服务
systemctl start mm-wiki

# 查看状态
systemctl status mm-wiki

 
```

```
阿里云账号：HZ667788
阿里云密码：xy059486
```

